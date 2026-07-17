import { attackableTargets, computeDamage } from '../engine/combat';
import { BUILDABLE_UNITS, TERRAIN_DATA, UNIT_DATA } from '../engine/data';
import { applyCommand, canBuildAt, canCaptureAt } from '../engine/game';
import { key, reachableTiles } from '../engine/movement';
import { createGame, tileAt, unitAt, unitById, visualHp } from '../engine/state';
import type { GameEvent, GameState, MapDef, Unit, UnitAction } from '../engine/types';
import { render, setupCanvas, TILE, type Overlays } from './renderer';

type UiMode =
  | { kind: 'idle' }
  | { kind: 'selected'; unitId: number; reachable: Map<string, number> }
  | { kind: 'menu'; unitId: number; to: { x: number; y: number } }
  | { kind: 'targeting'; unitId: number; to: { x: number; y: number }; targets: Unit[] }
  | { kind: 'building'; at: { x: number; y: number } };

interface Dom {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
  actionMenu: HTMLElement;
  banner: HTMLElement;
  buildMenu: HTMLElement;
  buildOptions: HTMLElement;
  buildCancel: HTMLElement;
  endTurnBtn: HTMLButtonElement;
  restartBtn: HTMLElement;
  dayLabel: HTMLElement;
  turnChip: HTMLElement;
  fundsRed: HTMLElement;
  fundsBlue: HTMLElement;
  tileInfo: HTMLElement;
  unitInfo: HTMLElement;
}

export class GameController {
  private state: GameState;
  private mode: UiMode = { kind: 'idle' };
  private ctx: CanvasRenderingContext2D;
  private hover: { x: number; y: number } | null = null;
  private bannerTimer: number | undefined;

  constructor(
    private map: MapDef,
    private dom: Dom,
  ) {
    this.state = createGame(map);
    this.ctx = setupCanvas(dom.canvas, this.state);

    dom.canvas.addEventListener('click', (e) => this.onClick(e));
    dom.canvas.addEventListener('mousemove', (e) => this.onHover(e));
    dom.canvas.addEventListener('mouseleave', () => {
      this.hover = null;
      this.draw();
    });
    dom.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancel();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cancel();
    });
    dom.endTurnBtn.addEventListener('click', () => this.endTurn());
    dom.restartBtn.addEventListener('click', () => this.restart());
    dom.buildCancel.addEventListener('click', () => this.cancel());

    this.showBanner(`${this.state.current} turn`, `Day ${this.state.day} — ${map.name}`, this.state.current, true);
    this.refresh();
  }

  // ----- input ---------------------------------------------------------

  private tileFromEvent(e: MouseEvent): { x: number; y: number } | null {
    const rect = this.dom.canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * this.state.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * this.state.height);
    if (x < 0 || x >= this.state.width || y < 0 || y >= this.state.height) return null;
    return { x, y };
  }

  private onClick(e: MouseEvent): void {
    if (this.state.winner) return;
    const pos = this.tileFromEvent(e);
    if (!pos) return;

    switch (this.mode.kind) {
      case 'idle':
        this.clickIdle(pos);
        break;
      case 'selected':
        this.clickSelected(pos);
        break;
      case 'targeting':
        this.clickTargeting(pos);
        break;
      case 'menu':
      case 'building':
        this.cancel();
        break;
    }
  }

  private clickIdle(pos: { x: number; y: number }): void {
    const unit = unitAt(this.state, pos.x, pos.y);
    if (unit && unit.owner === this.state.current && !unit.acted) {
      this.mode = { kind: 'selected', unitId: unit.id, reachable: reachableTiles(this.state, unit) };
      this.refresh();
      return;
    }
    if (!unit && canBuildAt(this.state, pos.x, pos.y)) {
      this.mode = { kind: 'building', at: pos };
      this.openBuildMenu();
      return;
    }
  }

  private clickSelected(pos: { x: number; y: number }): void {
    if (this.mode.kind !== 'selected') return;
    const unit = unitById(this.state, this.mode.unitId)!;

    // Clicking another of your ready units switches selection.
    const other = unitAt(this.state, pos.x, pos.y);
    if (other && other.id !== unit.id && other.owner === this.state.current && !other.acted) {
      this.mode = { kind: 'selected', unitId: other.id, reachable: reachableTiles(this.state, other) };
      this.refresh();
      return;
    }

    if (!this.mode.reachable.has(key(pos.x, pos.y))) {
      this.cancel();
      return;
    }
    this.mode = { kind: 'menu', unitId: unit.id, to: pos };
    this.openActionMenu(unit, pos);
    this.refresh();
  }

  private clickTargeting(pos: { x: number; y: number }): void {
    if (this.mode.kind !== 'targeting') return;
    const target = this.mode.targets.find((t) => t.x === pos.x && t.y === pos.y);
    if (!target) {
      this.cancel();
      return;
    }
    this.commitMove(this.mode.unitId, this.mode.to, { type: 'attack', targetId: target.id });
  }

  private onHover(e: MouseEvent): void {
    const pos = this.tileFromEvent(e);
    const changed = pos?.x !== this.hover?.x || pos?.y !== this.hover?.y;
    this.hover = pos;
    if (changed) {
      this.updateInfoPanels();
      this.draw();
    }
  }

  private cancel(): void {
    this.mode = { kind: 'idle' };
    this.dom.actionMenu.classList.add('hidden');
    this.dom.buildMenu.classList.add('hidden');
    this.refresh();
  }

  // ----- menus ---------------------------------------------------------

  private openActionMenu(unit: Unit, to: { x: number; y: number }): void {
    const moved = to.x !== unit.x || to.y !== unit.y;
    const targets = attackableTargets(this.state, unit, to.x, to.y, moved);
    const menu = this.dom.actionMenu;
    menu.innerHTML = '';

    const addButton = (label: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener('click', fn);
      menu.appendChild(b);
    };

    if (targets.length > 0) {
      addButton(`⚔ Attack (${targets.length})`, '', () => {
        this.mode = { kind: 'targeting', unitId: unit.id, to, targets };
        menu.classList.add('hidden');
        this.refresh();
      });
    }
    if (canCaptureAt(this.state, unit, to.x, to.y)) {
      addButton('⚑ Capture', '', () => this.commitMove(unit.id, to, { type: 'capture' }));
    }
    addButton('✔ Wait', '', () => this.commitMove(unit.id, to, { type: 'wait' }));
    addButton('✕ Cancel', 'danger', () => this.cancel());

    // Position beside the destination tile, clamped to the stage.
    const rect = this.dom.canvas.getBoundingClientRect();
    const scale = rect.width / (this.state.width * TILE);
    const left = Math.min((to.x + 1) * TILE * scale + 6, rect.width - 130);
    const top = Math.min(to.y * TILE * scale, rect.height - 150);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.classList.remove('hidden');
  }

  private openBuildMenu(): void {
    const options = this.dom.buildOptions;
    options.innerHTML = '';
    const funds = this.state.funds[this.state.current];

    for (const type of BUILDABLE_UNITS) {
      const data = UNIT_DATA[type];
      const b = document.createElement('button');
      b.className = 'build-option';
      b.disabled = data.cost > funds;
      const desc =
        data.minRange > 1
          ? `Range ${data.minRange}-${data.maxRange}, fires only when still`
          : data.canCapture
            ? 'Captures buildings'
            : `Move ${data.move}`;
      b.innerHTML = `<span>${data.name}<small>${desc}</small></span><span class="cost">$${data.cost}</span>`;
      b.addEventListener('click', () => {
        if (this.mode.kind !== 'building') return;
        this.apply({ kind: 'build', at: this.mode.at, unitType: type });
        this.cancel();
      });
      options.appendChild(b);
    }
    this.dom.buildMenu.classList.remove('hidden');
  }

  // ----- commands ------------------------------------------------------

  private commitMove(unitId: number, to: { x: number; y: number }, action: UnitAction): void {
    this.dom.actionMenu.classList.add('hidden');
    this.apply({ kind: 'move', unitId, to, action });
    this.mode = { kind: 'idle' };
    this.refresh();
  }

  private endTurn(): void {
    if (this.state.winner) return;
    this.cancel();
    this.apply({ kind: 'endTurn' });
  }

  private restart(): void {
    this.state = createGame(this.map);
    this.mode = { kind: 'idle' };
    this.dom.actionMenu.classList.add('hidden');
    this.dom.buildMenu.classList.add('hidden');
    this.showBanner(`${this.state.current} turn`, `Day ${this.state.day} — ${this.map.name}`, this.state.current, true);
    this.refresh();
  }

  private apply(cmd: Parameters<typeof applyCommand>[1]): void {
    try {
      const { state, events } = applyCommand(this.state, cmd);
      this.state = state;
      this.processEvents(events);
      this.refresh();
    } catch (err) {
      console.error(err);
      this.cancel();
    }
  }

  private processEvents(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'damage':
          this.spawnDamagePopup(ev.at, ev.amount, ev.destroyed);
          break;
        case 'turnStarted':
          this.showBanner(
            `${ev.player} turn`,
            `Day ${ev.day} — income $${ev.income} — pass the device`,
            ev.player,
            true,
          );
          break;
        case 'victory':
          this.showBanner(`${ev.winner} wins!`, 'Press Restart to play again', ev.winner, false);
          break;
        default:
          break;
      }
    }
  }

  // ----- presentation --------------------------------------------------

  private spawnDamagePopup(at: { x: number; y: number }, amount: number, destroyed: boolean): void {
    const rect = this.dom.canvas.getBoundingClientRect();
    const scale = rect.width / (this.state.width * TILE);
    const pop = document.createElement('div');
    pop.className = destroyed ? 'dmg-pop destroy' : 'dmg-pop';
    pop.textContent = destroyed ? '💥' : `-${Math.ceil(amount / 10)}`;
    pop.style.left = `${(at.x + 0.3) * TILE * scale}px`;
    pop.style.top = `${at.y * TILE * scale}px`;
    this.dom.stage.appendChild(pop);
    window.setTimeout(() => pop.remove(), 1000);
  }

  private showBanner(title: string, sub: string, player: string, autoFade: boolean): void {
    const banner = this.dom.banner;
    window.clearTimeout(this.bannerTimer);
    banner.className = player;
    banner.innerHTML = `<div>${title.toUpperCase()}</div><div class="sub">${sub}</div>`;
    if (autoFade) {
      this.bannerTimer = window.setTimeout(() => {
        banner.classList.add('fading');
        this.bannerTimer = window.setTimeout(() => banner.classList.add('hidden'), 400);
      }, 1300);
    }
  }

  private refresh(): void {
    this.refreshHud();
    this.updateInfoPanels();
    this.draw();
  }

  private refreshHud(): void {
    const s = this.state;
    this.dom.dayLabel.textContent = `Day ${s.day}`;
    this.dom.turnChip.textContent = s.winner ? `${s.winner} wins` : `${s.current}'s turn`;
    this.dom.turnChip.className = `chip ${s.winner ?? s.current}`;
    this.dom.fundsRed.textContent = `Red $${s.funds.red}`;
    this.dom.fundsBlue.textContent = `Blue $${s.funds.blue}`;
    this.dom.endTurnBtn.disabled = s.winner !== null;
  }

  private updateInfoPanels(): void {
    const pos = this.hover;
    if (!pos) {
      this.dom.tileInfo.textContent = 'Hover a tile';
      this.dom.unitInfo.textContent = '—';
      return;
    }
    const tile = tileAt(this.state, pos.x, pos.y);
    const td = TERRAIN_DATA[tile.terrain];
    const ownerText = td.capturable ? ` · ${tile.owner ?? 'neutral'}` : '';
    this.dom.tileInfo.innerHTML = `
      <div class="row"><span>${td.name}${ownerText}</span><span>${'★'.repeat(td.defenseStars) || '—'}</span></div>
      ${td.capturable ? '<div class="row"><span>Income</span><span>$1000</span></div>' : ''}
    `;

    const unit = unitAt(this.state, pos.x, pos.y);
    if (!unit) {
      this.dom.unitInfo.textContent = '—';
      return;
    }
    const ud = UNIT_DATA[unit.type];
    const range = ud.minRange === ud.maxRange ? `${ud.maxRange}` : `${ud.minRange}-${ud.maxRange}`;
    let forecast = '';
    if (this.mode.kind === 'targeting' && unit.owner !== this.state.current) {
      const attacker = unitById(this.state, this.mode.unitId);
      if (attacker && this.mode.targets.some((t) => t.id === unit.id)) {
        const dmg = computeDamage(this.state, attacker, unit);
        forecast = `<div class="row"><span>Forecast</span><span>-${Math.ceil(dmg / 10)} HP</span></div>`;
      }
    }
    this.dom.unitInfo.innerHTML = `
      <div class="row"><span><b>${ud.name}</b> (${unit.owner})</span><span>${visualHp(unit)}/10 HP</span></div>
      <div class="row"><span>Move ${ud.move}</span><span>Range ${range}</span></div>
      ${unit.acted && unit.owner === this.state.current ? '<div class="row"><span>Already acted</span></div>' : ''}
      ${forecast}
    `;
  }

  private draw(): void {
    const ov: Overlays = { hover: this.hover ?? undefined };
    switch (this.mode.kind) {
      case 'selected':
        ov.reachable = new Set(this.mode.reachable.keys());
        ov.selectedUnitId = this.mode.unitId;
        break;
      case 'menu':
        ov.ghost = { unitId: this.mode.unitId, x: this.mode.to.x, y: this.mode.to.y };
        break;
      case 'targeting':
        ov.ghost = { unitId: this.mode.unitId, x: this.mode.to.x, y: this.mode.to.y };
        ov.targets = new Set(this.mode.targets.map((t) => t.id));
        break;
      default:
        break;
    }
    render(this.ctx, this.state, ov);
  }
}
