import { CAPTURE_POINTS, MAX_HP, TERRAIN_DATA, UNIT_DATA } from '../engine/data';
import { encodeMapDef, validateMapDef } from '../engine/serialize';
import { CHAR_TERRAIN } from '../engine/state';
import type { GameState, MapDef, MapUnitDef, PlayerId, Terrain, Tile, UnitType } from '../engine/types';
import { render, setupCanvas, TILE } from './renderer';

type Tool =
  | { kind: 'terrain'; terrain: Terrain }
  | { kind: 'unit'; unitType: UnitType }
  | { kind: 'eraseUnit' };

interface EditorTile {
  terrain: Terrain;
  owner: PlayerId | null;
}

interface SavedMap {
  name: string;
  width: number;
  height: number;
  tiles: EditorTile[];
  units: MapUnitDef[];
  funds: number;
}

const STORAGE_KEY = 'tactics-clash-editor';
const TERRAIN_CHAR = Object.fromEntries(
  Object.entries(CHAR_TERRAIN).map(([ch, t]) => [t, ch]),
) as Record<Terrain, string>;

const TERRAIN_LABELS: Record<Terrain, string> = {
  plain: '🟩 Plains',
  road: '🛣 Road',
  forest: '🌲 Forest',
  mountain: '⛰ Mountain',
  water: '🌊 Water',
  city: '🏢 City',
  factory: '🏭 Factory',
  hq: '🏰 HQ',
};

export class MapEditor {
  private name = 'Custom Map';
  private width = 15;
  private height = 10;
  private tiles: EditorTile[] = [];
  private units: MapUnitDef[] = [];
  private funds = 2000;
  private tool: Tool = { kind: 'terrain', terrain: 'plain' };
  private painting = false;
  private ctx: CanvasRenderingContext2D | null = null;

  private el = {
    modal: document.getElementById('editor')!,
    board: document.getElementById('editor-board') as HTMLCanvasElement,
    palette: document.getElementById('editor-palette')!,
    status: document.getElementById('editor-status')!,
    name: document.getElementById('editor-name') as HTMLInputElement,
    w: document.getElementById('editor-w') as HTMLInputElement,
    h: document.getElementById('editor-h') as HTMLInputElement,
    funds: document.getElementById('editor-funds') as HTMLInputElement,
    sizeApply: document.getElementById('editor-size-apply')!,
    play: document.getElementById('editor-play')!,
    share: document.getElementById('editor-share')!,
    clear: document.getElementById('editor-clear')!,
    close: document.getElementById('editor-close')!,
  };

  constructor(private onPlay: (map: MapDef) => void) {
    this.blankMap();
    this.load();
    this.buildPalette();

    this.el.board.addEventListener('mousedown', (e) => {
      this.painting = true;
      this.paintAt(e);
    });
    this.el.board.addEventListener('mousemove', (e) => {
      if (this.painting && this.tool.kind === 'terrain') this.paintAt(e);
    });
    window.addEventListener('mouseup', () => (this.painting = false));

    this.el.sizeApply.addEventListener('click', () => this.resize());
    this.el.name.addEventListener('change', () => {
      this.name = this.el.name.value.trim() || 'Custom Map';
      this.save();
    });
    this.el.funds.addEventListener('change', () => {
      this.funds = Math.max(0, Number(this.el.funds.value) || 0);
      this.save();
    });
    this.el.clear.addEventListener('click', () => {
      this.blankMap();
      this.afterChange();
    });
    this.el.close.addEventListener('click', () => this.el.modal.classList.add('hidden'));
    this.el.play.addEventListener('click', () => {
      const errors = validateMapDef(this.toMapDef());
      if (errors.length > 0) {
        this.showStatus();
        return;
      }
      this.el.modal.classList.add('hidden');
      this.onPlay(this.toMapDef());
    });
    this.el.share.addEventListener('click', () => void this.copyShareLink());
  }

  open(): void {
    this.el.modal.classList.remove('hidden');
    this.el.name.value = this.name;
    this.el.w.value = String(this.width);
    this.el.h.value = String(this.height);
    this.el.funds.value = String(this.funds);
    this.redraw(true);
    this.showStatus();
  }

  /** Load an existing map (e.g. from a #map= link) into the editor. */
  loadMap(map: MapDef): void {
    this.name = map.name;
    this.height = map.grid.length;
    this.width = map.grid[0].length;
    this.tiles = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.tiles.push({ terrain: CHAR_TERRAIN[map.grid[y][x]], owner: null });
      }
    }
    for (const p of map.properties) this.tiles[p.y * this.width + p.x].owner = p.owner;
    this.units = map.units.map((u) => ({ ...u }));
    this.funds = typeof map.startingFunds === 'number' ? map.startingFunds : map.startingFunds.red;
    this.save();
  }

  // ----- editing --------------------------------------------------------

  private blankMap(): void {
    this.tiles = Array.from({ length: this.width * this.height }, () => ({
      terrain: 'plain' as Terrain,
      owner: null,
    }));
    this.units = [];
  }

  private resize(): void {
    const w = Math.min(30, Math.max(5, Number(this.el.w.value) || 15));
    const h = Math.min(20, Math.max(5, Number(this.el.h.value) || 10));
    const old = { w: this.width, h: this.height, tiles: this.tiles };
    this.width = w;
    this.height = h;
    this.blankMap();
    // Keep the overlapping region of the old map.
    for (let y = 0; y < Math.min(h, old.h); y++) {
      for (let x = 0; x < Math.min(w, old.w); x++) {
        this.tiles[y * w + x] = old.tiles[y * old.w + x];
      }
    }
    this.units = this.units.filter((u) => u.x < w && u.y < h);
    this.el.w.value = String(w);
    this.el.h.value = String(h);
    this.afterChange(true);
  }

  private selectedOwner(): PlayerId | null {
    const checked = document.querySelector<HTMLInputElement>('input[name="editor-owner"]:checked');
    return checked && checked.value !== 'neutral' ? (checked.value as PlayerId) : null;
  }

  private paintAt(e: MouseEvent): void {
    const rect = this.el.board.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * this.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * this.height);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = y * this.width + x;
    const owner = this.selectedOwner();

    switch (this.tool.kind) {
      case 'terrain': {
        const terrain = this.tool.terrain;
        if (terrain === 'hq' && !owner) {
          this.setStatus('Select Red or Blue before painting an HQ.', false);
          return;
        }
        this.tiles[idx] = {
          terrain,
          owner: TERRAIN_DATA[terrain].capturable ? owner : null,
        };
        // Evict units that can no longer stand here.
        this.units = this.units.filter(
          (u) =>
            u.x !== x ||
            u.y !== y ||
            TERRAIN_DATA[terrain].moveCost[UNIT_DATA[u.type].moveClass] !== null,
        );
        break;
      }
      case 'unit': {
        if (!owner) {
          this.setStatus('Select Red or Blue to place units.', false);
          return;
        }
        const type = this.tool.unitType;
        if (TERRAIN_DATA[this.tiles[idx].terrain].moveCost[UNIT_DATA[type].moveClass] === null) {
          this.setStatus(`${UNIT_DATA[type].name} cannot stand on ${this.tiles[idx].terrain}.`, false);
          return;
        }
        this.units = this.units.filter((u) => u.x !== x || u.y !== y);
        this.units.push({ type, owner, x, y });
        break;
      }
      case 'eraseUnit':
        this.units = this.units.filter((u) => u.x !== x || u.y !== y);
        break;
    }
    this.afterChange();
  }

  private afterChange(resized = false): void {
    this.save();
    this.redraw(resized);
    this.showStatus();
  }

  // ----- palette --------------------------------------------------------

  private buildPalette(): void {
    const palette = this.el.palette;
    palette.innerHTML = '';
    const addHeading = (text: string) => {
      const s = document.createElement('div');
      s.className = 'palette-heading';
      s.textContent = text;
      palette.appendChild(s);
    };
    const addButton = (label: string, tool: Tool) => {
      const b = document.createElement('button');
      b.className = 'palette-btn';
      b.textContent = label;
      b.addEventListener('click', () => {
        this.tool = tool;
        for (const other of palette.querySelectorAll('.palette-btn')) other.classList.remove('active');
        b.classList.add('active');
      });
      palette.appendChild(b);
      return b;
    };

    addHeading('Terrain (drag to paint)');
    (Object.keys(TERRAIN_LABELS) as Terrain[]).forEach((t, i) => {
      const b = addButton(TERRAIN_LABELS[t], { kind: 'terrain', terrain: t });
      if (i === 0) b.classList.add('active');
    });
    addHeading('Units (pick owner above)');
    for (const type of Object.keys(UNIT_DATA) as UnitType[]) {
      addButton(UNIT_DATA[type].name, { kind: 'unit', unitType: type });
    }
    addButton('❌ Erase unit', { kind: 'eraseUnit' });
  }

  // ----- rendering ------------------------------------------------------

  private toGameState(): GameState {
    const tiles: Tile[] = this.tiles.map((t) => ({
      terrain: t.terrain,
      owner: t.owner,
      capturePoints: CAPTURE_POINTS,
      capturingUnitId: null,
    }));
    return {
      width: this.width,
      height: this.height,
      tiles,
      units: this.units.map((u, i) => ({
        id: i + 1,
        type: u.type,
        owner: u.owner,
        x: u.x,
        y: u.y,
        hp: MAX_HP,
        acted: false,
      })),
      nextUnitId: this.units.length + 1,
      current: 'red',
      day: 1,
      funds: { red: 0, blue: 0 },
      winner: null,
      fog: false,
    };
  }

  private redraw(resized = false): void {
    const state = this.toGameState();
    if (!this.ctx || resized) {
      this.ctx = setupCanvas(this.el.board, state);
      this.el.board.style.maxWidth = `${this.width * TILE}px`;
    }
    render(this.ctx, state);
  }

  // ----- output ---------------------------------------------------------

  private toMapDef(): MapDef {
    const grid: string[] = [];
    const properties: MapDef['properties'] = [];
    for (let y = 0; y < this.height; y++) {
      let row = '';
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y * this.width + x];
        row += TERRAIN_CHAR[tile.terrain];
        if (tile.owner && TERRAIN_DATA[tile.terrain].capturable) {
          properties.push({ x, y, owner: tile.owner });
        }
      }
      grid.push(row);
    }
    return {
      name: this.name,
      grid,
      properties,
      units: this.units.map((u) => ({ ...u })),
      startingFunds: this.funds,
    };
  }

  private async copyShareLink(): Promise<void> {
    const map = this.toMapDef();
    const errors = validateMapDef(map);
    if (errors.length > 0) {
      this.showStatus();
      return;
    }
    const code = await encodeMapDef(map);
    const url = `${location.origin}${location.pathname}#map=${code}`;
    await navigator.clipboard?.writeText(url).catch(() => {});
    this.setStatus(`Link copied (${url.length} chars): ${url.slice(0, 60)}…`, true);
  }

  private showStatus(): void {
    const errors = validateMapDef(this.toMapDef());
    if (errors.length === 0) {
      this.setStatus('✓ Map is playable. Play it, or copy a share link.', true);
    } else {
      this.setStatus(errors.slice(0, 3).join(' · '), false);
    }
  }

  private setStatus(text: string, ok: boolean): void {
    this.el.status.textContent = text;
    this.el.status.className = ok ? 'editor-status ok' : 'editor-status';
  }

  // ----- persistence ----------------------------------------------------

  private save(): void {
    const data: SavedMap = {
      name: this.name,
      width: this.width,
      height: this.height,
      tiles: this.tiles,
      units: this.units,
      funds: this.funds,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as SavedMap;
      if (!data.tiles || data.tiles.length !== data.width * data.height) return;
      this.name = data.name || 'Custom Map';
      this.width = data.width;
      this.height = data.height;
      this.tiles = data.tiles;
      this.units = data.units ?? [];
      this.funds = data.funds ?? 2000;
    } catch {
      // Corrupt autosave: start fresh.
    }
  }
}
