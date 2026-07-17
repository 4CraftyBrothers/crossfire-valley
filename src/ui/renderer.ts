import { TERRAIN_DATA, CAPTURE_POINTS } from '../engine/data';
import { tileAt, unitById, visualHp } from '../engine/state';
import type { GameState, PlayerId, Tile, Unit } from '../engine/types';

export const TILE = 48;

const PLAYER_COLORS: Record<PlayerId, { body: string; dark: string }> = {
  red: { body: '#e05545', dark: '#8f2a1e' },
  blue: { body: '#4a7de0', dark: '#24448f' },
};

const NEUTRAL = { body: '#b0aca4', dark: '#6d6a64' };

export interface Overlays {
  reachable?: Set<string>;
  targets?: Set<number>;
  selectedUnitId?: number;
  /** Ghost position for a unit mid-move (before the action is chosen). */
  ghost?: { unitId: number; x: number; y: number };
  hover?: { x: number; y: number };
}

export function setupCanvas(canvas: HTMLCanvasElement, state: GameState): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = state.width * TILE * dpr;
  canvas.height = state.height * TILE * dpr;
  canvas.style.aspectRatio = `${state.width} / ${state.height}`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ov: Overlays = {},
  visible?: Set<number>,
): void {
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      drawTile(ctx, state, x, y);
    }
  }

  // Fog shroud: terrain stays legible, everything else is hidden below.
  if (visible) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.48)';
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (!visible.has(y * state.width + x)) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  if (ov.reachable) {
    ctx.fillStyle = 'rgba(120, 190, 255, 0.42)';
    for (const k of ov.reachable) {
      const [x, y] = k.split(',').map(Number);
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  for (const unit of state.units) {
    if (ov.ghost && unit.id === ov.ghost.unitId) continue;
    if (visible && !visible.has(unit.y * state.width + unit.x)) continue;
    drawUnit(ctx, state, unit, unit.x, unit.y, ov.selectedUnitId === unit.id);
  }

  if (ov.ghost) {
    const unit = unitById(state, ov.ghost.unitId);
    if (unit) {
      ctx.globalAlpha = 0.85;
      drawUnit(ctx, state, unit, ov.ghost.x, ov.ghost.y, true);
      ctx.globalAlpha = 1;
    }
  }

  if (ov.targets) {
    for (const id of ov.targets) {
      const t = unitById(state, id);
      if (t) drawCrosshair(ctx, t.x, t.y);
    }
  }

  if (ov.hover) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ov.hover.x * TILE + 1.5, ov.hover.y * TILE + 1.5, TILE - 3, TILE - 3);
  }
}

function drawTile(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number): void {
  const tile = tileAt(state, x, y);
  const px = x * TILE;
  const py = y * TILE;
  const checker = (x + y) % 2 === 0;

  // Grass base for everything except water/road.
  ctx.fillStyle = checker ? '#7fbf4d' : '#77b747';
  ctx.fillRect(px, py, TILE, TILE);

  switch (tile.terrain) {
    case 'water': {
      ctx.fillStyle = checker ? '#4794e0' : '#418cd6';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px + TILE * 0.35, py + TILE * 0.45, 6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.arc(px + TILE * 0.7, py + TILE * 0.7, 5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    case 'road': {
      ctx.fillStyle = checker ? '#c9bd9c' : '#c1b594';
      ctx.fillRect(px, py, TILE, TILE);
      break;
    }
    case 'forest': {
      drawTree(ctx, px + TILE * 0.3, py + TILE * 0.55, TILE * 0.3);
      drawTree(ctx, px + TILE * 0.68, py + TILE * 0.72, TILE * 0.26);
      break;
    }
    case 'mountain': {
      const mx = px + TILE / 2;
      ctx.fillStyle = '#8d8272';
      ctx.beginPath();
      ctx.moveTo(px + 6, py + TILE - 7);
      ctx.lineTo(mx, py + 7);
      ctx.lineTo(px + TILE - 6, py + TILE - 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f2ede4';
      ctx.beginPath();
      ctx.moveTo(mx - 7, py + 18);
      ctx.lineTo(mx, py + 7);
      ctx.lineTo(mx + 7, py + 18);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'city':
      drawBuilding(ctx, px, py, tile, 'city');
      break;
    case 'factory':
      drawBuilding(ctx, px, py, tile, 'factory');
      break;
    case 'hq':
      drawBuilding(ctx, px, py, tile, 'hq');
      break;
    case 'plain':
      break;
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
}

function drawTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.fillStyle = '#5b4326';
  ctx.fillRect(cx - 2, cy + size * 0.3, 4, size * 0.4);
  ctx.fillStyle = '#2f7a3a';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.55, cy + size * 0.35);
  ctx.lineTo(cx, cy - size * 0.75);
  ctx.lineTo(cx + size * 0.55, cy + size * 0.35);
  ctx.closePath();
  ctx.fill();
}

function ownerColors(tile: Tile) {
  return tile.owner ? PLAYER_COLORS[tile.owner] : NEUTRAL;
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  tile: Tile,
  kind: 'city' | 'factory' | 'hq',
): void {
  const c = ownerColors(tile);
  const w = TILE - 14;
  const h = TILE - 18;
  const bx = px + 7;
  const by = py + 11;

  ctx.fillStyle = c.body;
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 2;

  if (kind === 'hq') {
    // Tall keep with a flag.
    ctx.fillRect(bx + 4, by - 2, w - 8, h + 4);
    ctx.strokeRect(bx + 4, by - 2, w - 8, h + 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + w / 2 - 1, by - 12, 2, 12);
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.moveTo(bx + w / 2 + 1, by - 12);
    ctx.lineTo(bx + w / 2 + 13, by - 8.5);
    ctx.lineTo(bx + w / 2 + 1, by - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    drawStar(ctx, bx + w / 2, by + h / 2 + 1, 6);
  } else if (kind === 'factory') {
    ctx.fillRect(bx, by + 4, w, h - 4);
    ctx.strokeRect(bx, by + 4, w, h - 4);
    // Chimney + sawtooth roof.
    ctx.fillRect(bx + 3, by - 6, 6, 12);
    ctx.beginPath();
    ctx.moveTo(bx, by + 5);
    ctx.lineTo(bx + w / 3, by - 2);
    ctx.lineTo(bx + w / 3, by + 5);
    ctx.lineTo(bx + (2 * w) / 3, by - 2);
    ctx.lineTo(bx + (2 * w) / 3, by + 5);
    ctx.fill();
  } else {
    // City: two small blocks with windows.
    ctx.fillRect(bx, by + 6, w * 0.45, h - 6);
    ctx.strokeRect(bx, by + 6, w * 0.45, h - 6);
    ctx.fillRect(bx + w * 0.5, by, w * 0.5, h);
    ctx.strokeRect(bx + w * 0.5, by, w * 0.5, h);
    ctx.fillStyle = 'rgba(255,255,230,0.85)';
    ctx.fillRect(bx + w * 0.58, by + 4, 4, 4);
    ctx.fillRect(bx + w * 0.58, by + 12, 4, 4);
    ctx.fillRect(bx + w * 0.78, by + 4, 4, 4);
  }

  // Capture-in-progress bar.
  if (tile.capturingUnitId !== null && tile.capturePoints < CAPTURE_POINTS) {
    const frac = 1 - tile.capturePoints / CAPTURE_POINTS;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px + 6, py + TILE - 8, TILE - 12, 5);
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(px + 6, py + TILE - 8, (TILE - 12) * frac, 5);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  unit: Unit,
  x: number,
  y: number,
  selected: boolean,
): void {
  const px = x * TILE;
  const py = y * TILE;
  const c = PLAYER_COLORS[unit.owner];
  const acted = unit.acted && unit.owner === state.current;

  ctx.save();
  if (acted) ctx.filter = 'grayscale(75%) brightness(0.85)';

  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 2;
  ctx.fillStyle = c.body;

  switch (unit.type) {
    case 'infantry':
    case 'bazooka': {
      const cx = px + TILE / 2;
      const cy = py + TILE / 2 + 3;
      // Body + head.
      ctx.beginPath();
      ctx.ellipse(cx, cy + 5, 8, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Weapon: rifle (thin) or bazooka tube (thick, on shoulder).
      ctx.strokeStyle = '#3a3a3a';
      if (unit.type === 'bazooka') {
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 4);
        ctx.lineTo(cx + 13, cy - 14);
        ctx.stroke();
      } else {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy + 8);
        ctx.lineTo(cx + 12, cy - 10);
        ctx.stroke();
      }
      break;
    }
    case 'recon': {
      // Wheeled scout car.
      ctx.fillStyle = '#2c2c2c';
      ctx.beginPath();
      ctx.arc(px + 14, py + TILE - 12, 5.5, 0, Math.PI * 2);
      ctx.arc(px + TILE - 14, py + TILE - 12, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.body;
      roundRect(ctx, px + 7, py + 16, TILE - 14, 16, 4);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, px + 15, py + 9, 14, 10, 3);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'lightTank':
    case 'heavyTank': {
      const heavy = unit.type === 'heavyTank';
      const inset = heavy ? 4 : 7;
      // Treads.
      ctx.fillStyle = '#2c2c2c';
      roundRect(ctx, px + inset, py + TILE - 20, TILE - inset * 2, 13, 5);
      ctx.fill();
      // Hull + turret + barrel.
      ctx.fillStyle = c.body;
      roundRect(ctx, px + inset + 2, py + 20, TILE - (inset + 2) * 2, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + 19, heavy ? 8 : 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = heavy ? 4.5 : 3.5;
      ctx.beginPath();
      ctx.moveTo(px + TILE / 2 + 4, py + 17);
      ctx.lineTo(px + TILE - (heavy ? 3 : 7), py + 13);
      ctx.stroke();
      if (heavy) {
        ctx.fillStyle = c.dark;
        ctx.fillRect(px + inset + 4, py + 23, 5, 5);
        ctx.fillRect(px + TILE - inset - 9, py + 23, 5, 5);
      }
      break;
    }
    case 'artillery': {
      // Tracked hull with a long high-angle barrel.
      ctx.fillStyle = '#2c2c2c';
      roundRect(ctx, px + 8, py + TILE - 18, TILE - 16, 11, 4);
      ctx.fill();
      ctx.fillStyle = c.body;
      roundRect(ctx, px + 10, py + 24, TILE - 20, 10, 3);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(px + TILE / 2 - 2, py + 27);
      ctx.lineTo(px + TILE - 10, py + 8);
      ctx.stroke();
      ctx.fillStyle = c.dark;
      ctx.beginPath();
      ctx.arc(px + TILE / 2 - 2, py + 27, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();

  // HP badge when damaged.
  const hp = visualHp(unit);
  if (hp < 10) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    ctx.strokeText(String(hp), px + TILE - 3, py + TILE - 2);
    ctx.fillText(String(hp), px + TILE - 3, py + TILE - 2);
  }

  if (selected) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    roundRect(ctx, px + 2, py + 2, TILE - 4, TILE - 4, 8);
    ctx.stroke();
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = 'rgba(255, 70, 40, 0.28)';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = '#ff4628';
  ctx.lineWidth = 3;
  const g = 7;
  const s = 13;
  ctx.beginPath();
  // Four corner brackets.
  ctx.moveTo(px + g, py + g + s); ctx.lineTo(px + g, py + g); ctx.lineTo(px + g + s, py + g);
  ctx.moveTo(px + TILE - g - s, py + g); ctx.lineTo(px + TILE - g, py + g); ctx.lineTo(px + TILE - g, py + g + s);
  ctx.moveTo(px + TILE - g, py + TILE - g - s); ctx.lineTo(px + TILE - g, py + TILE - g); ctx.lineTo(px + TILE - g - s, py + TILE - g);
  ctx.moveTo(px + g + s, py + TILE - g); ctx.lineTo(px + g, py + TILE - g); ctx.lineTo(px + g, py + TILE - g - s);
  ctx.stroke();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export { TERRAIN_DATA };
