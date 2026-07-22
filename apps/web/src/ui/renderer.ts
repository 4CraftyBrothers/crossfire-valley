import { CAPTURE_POINTS } from '@crossfire/engine';
import { tileAt, unitById, visualHp } from '@crossfire/engine';
import type { GameState, PlayerId, Tile, Unit } from '@crossfire/engine';

export const TILE = 48;

/** Style #13: top-down, shaded, gritty, team-readable. */
const PLAYER_COLORS: Record<PlayerId, { top: string; mid: string; dark: string }> = {
  red: { top: '#c94e39', mid: '#a83c2b', dark: '#6e2418' },
  blue: { top: '#3f6bb0', mid: '#345a95', dark: '#203a63' },
};

const NEUTRAL = { top: '#8a8578', mid: '#7a7568', dark: '#55524a' };
const OLIVE = { top: '#6b6f4a', dark: '#44472f' };
const GUN = '#43454d';
const GUN_DARK = '#2f2f2f';

export interface Overlays {
  reachable?: Set<string>;
  targets?: Set<number>;
  selectedUnitId?: number;
  /** Ghost position for a unit mid-move (before the action is chosen). */
  ghost?: { unitId: number; x: number; y: number };
  /** Animated position override (float tile coords) for a sliding unit. */
  slide?: { unitId: number; x: number; y: number; angle?: number; phase?: number };
  /** Units concealed from the viewing player (forest ambushers in fog). */
  hiddenUnits?: Set<number>;
  hover?: { x: number; y: number };
}

/** Which way a unit points when we know nothing else: toward the enemy. */
export function defaultFacing(owner: PlayerId): number {
  return owner === 'red' ? Math.PI / 2 : -Math.PI / 2;
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
  facings?: Map<number, number>,
): void {
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      drawTile(ctx, state, x, y);
    }
  }

  // Fog shroud: terrain stays legible, everything else is hidden below.
  if (visible) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.52)';
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (!visible.has(y * state.width + x)) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  if (ov.reachable) {
    ctx.fillStyle = 'rgba(140, 200, 255, 0.40)';
    for (const k of ov.reachable) {
      const [x, y] = k.split(',').map(Number);
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  const facingOf = (unit: Unit) => facings?.get(unit.id) ?? defaultFacing(unit.owner);

  for (const unit of state.units) {
    if (ov.ghost && unit.id === ov.ghost.unitId) continue;
    if (ov.slide && unit.id === ov.slide.unitId) {
      const sx = Math.round(ov.slide.x);
      const sy = Math.round(ov.slide.y);
      if (!visible || visible.has(sy * state.width + sx)) {
        drawUnit(
          ctx,
          state,
          { ...unit, acted: false },
          ov.slide.x,
          ov.slide.y,
          false,
          ov.slide.angle ?? facingOf(unit),
          { phase: ov.slide.phase ?? 0, moving: true },
        );
      }
      continue;
    }
    if (visible && !visible.has(unit.y * state.width + unit.x)) continue;
    if (ov.hiddenUnits?.has(unit.id)) continue;
    drawUnit(ctx, state, unit, unit.x, unit.y, ov.selectedUnitId === unit.id, facingOf(unit));
  }

  if (ov.ghost) {
    const unit = unitById(state, ov.ghost.unitId);
    if (unit) {
      ctx.globalAlpha = 0.85;
      drawUnit(ctx, state, unit, ov.ghost.x, ov.ghost.y, true, facingOf(unit));
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

// ----- terrain ---------------------------------------------------------------

const TERRAIN_BASE: Record<'a' | 'b', string> = { a: '#6d7f4a', b: '#657645' };

function drawTile(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number): void {
  const tile = tileAt(state, x, y);
  const px = x * TILE;
  const py = y * TILE;
  const checker = (x + y) % 2 === 0;

  // Muted field base for everything except water/road.
  ctx.fillStyle = checker ? TERRAIN_BASE.a : TERRAIN_BASE.b;
  ctx.fillRect(px, py, TILE, TILE);
  if (tile.terrain === 'plain' || tile.terrain === 'forest') {
    ctx.fillStyle = 'rgba(60,66,40,0.5)';
    const spots: [number, number, number][] = checker
      ? [[0.2, 0.3, 1.5], [0.7, 0.15, 1.2], [0.82, 0.6, 1.6], [0.35, 0.78, 1.3]]
      : [[0.65, 0.7, 1.5], [0.25, 0.55, 1.2], [0.55, 0.25, 1.4]];
    for (const [fx, fy, r] of spots) {
      ctx.beginPath();
      ctx.ellipse(px + fx * TILE, py + fy * TILE, r, r * 0.7, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  switch (tile.terrain) {
    case 'water': {
      ctx.fillStyle = checker ? '#4d7086' : '#476a80';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px + TILE * 0.35, py + TILE * 0.45, 6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.arc(px + TILE * 0.7, py + TILE * 0.7, 5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    case 'road': {
      ctx.fillStyle = checker ? '#8b8264' : '#847b5e';
      ctx.fillRect(px, py, TILE, TILE);
      // tire ruts
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py + TILE * 0.35); ctx.lineTo(px + TILE, py + TILE * 0.35);
      ctx.moveTo(px, py + TILE * 0.65); ctx.lineTo(px + TILE, py + TILE * 0.65);
      ctx.stroke();
      break;
    }
    case 'forest': {
      drawTree(ctx, px + TILE * 0.3, py + TILE * 0.55, TILE * 0.3);
      drawTree(ctx, px + TILE * 0.68, py + TILE * 0.72, TILE * 0.26);
      break;
    }
    case 'mountain': {
      const mx = px + TILE / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(mx + 2, py + TILE - 8, TILE * 0.38, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a7264';
      ctx.beginPath();
      ctx.moveTo(px + 6, py + TILE - 7);
      ctx.lineTo(mx, py + 7);
      ctx.lineTo(px + TILE - 6, py + TILE - 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5f594e';
      ctx.beginPath();
      ctx.moveTo(mx, py + 7);
      ctx.lineTo(px + TILE - 6, py + TILE - 7);
      ctx.lineTo(mx + 6, py + TILE - 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d9d4c8';
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

  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
}

function drawTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + size * 0.66, size * 0.5, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#463726';
  ctx.fillRect(cx - 2, cy + size * 0.3, 4, size * 0.4);
  ctx.fillStyle = '#3d5a35';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.55, cy + size * 0.35);
  ctx.lineTo(cx, cy - size * 0.75);
  ctx.lineTo(cx + size * 0.55, cy + size * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2f4729';
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.75);
  ctx.lineTo(cx + size * 0.55, cy + size * 0.35);
  ctx.lineTo(cx, cy + size * 0.35);
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

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2 + 2, py + TILE - 8, w * 0.6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = c.top;
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = 2;

  if (kind === 'hq') {
    ctx.fillRect(bx + 4, by - 2, w - 8, h + 4);
    ctx.strokeRect(bx + 4, by - 2, w - 8, h + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bx + w / 2, by - 2, w / 2 - 4, h + 4);
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(bx + w / 2 - 1, by - 12, 2, 12);
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.moveTo(bx + w / 2 + 1, by - 12);
    ctx.lineTo(bx + w / 2 + 13, by - 8.5);
    ctx.lineTo(bx + w / 2 + 1, by - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d9c26a';
    drawStar(ctx, bx + w / 2, by + h / 2 + 1, 6);
  } else if (kind === 'factory') {
    ctx.fillRect(bx, by + 4, w, h - 4);
    ctx.strokeRect(bx, by + 4, w, h - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bx + w / 2, by + 4, w / 2, h - 4);
    ctx.fillStyle = c.top;
    ctx.fillRect(bx + 3, by - 6, 6, 12);
    ctx.beginPath();
    ctx.moveTo(bx, by + 5);
    ctx.lineTo(bx + w / 3, by - 2);
    ctx.lineTo(bx + w / 3, by + 5);
    ctx.lineTo(bx + (2 * w) / 3, by - 2);
    ctx.lineTo(bx + (2 * w) / 3, by + 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,200,200,0.35)';
    ctx.beginPath();
    ctx.arc(bx + 6, by - 8, 2.5, 0, Math.PI * 2);
    ctx.arc(bx + 10, by - 11, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(bx, by + 6, w * 0.45, h - 6);
    ctx.strokeRect(bx, by + 6, w * 0.45, h - 6);
    ctx.fillRect(bx + w * 0.5, by, w * 0.5, h);
    ctx.strokeRect(bx + w * 0.5, by, w * 0.5, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bx + w * 0.75, by, w * 0.25, h);
    ctx.fillStyle = 'rgba(255,244,200,0.75)';
    ctx.fillRect(bx + w * 0.58, by + 4, 4, 4);
    ctx.fillRect(bx + w * 0.58, by + 12, 4, 4);
    ctx.fillRect(bx + 3, by + 10, 3, 3);
  }

  // Capture-in-progress bar.
  if (tile.capturingUnitId !== null && tile.capturePoints < CAPTURE_POINTS) {
    const frac = 1 - tile.capturePoints / CAPTURE_POINTS;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px + 6, py + TILE - 8, TILE - 12, 5);
    ctx.fillStyle = '#d9c26a';
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

// ----- units (all sprites drawn facing up in a 48-unit box) ------------------

type Team = { top: string; mid: string; dark: string };
type Pt = (v: number) => number;

/**
 * Movement animation state for a sprite. `phase` is the distance
 * traveled so far in tile units, so tread scroll and walk cadence stay
 * locked to actual ground speed.
 */
export interface Motion {
  phase: number;
  moving: boolean;
}

const STILL: Motion = { phase: 0, moving: false };

/** Lateral march offset for a soldier; seed staggers squadmates. */
function marchSway(m: Motion, seed: number): number {
  return m.moving ? Math.sin(m.phase * Math.PI * 5 + seed) * 1.4 : 0;
}

function shadowEl(ctx: CanvasRenderingContext2D, X: Pt, Y: Pt, u: number, cx: number, cy: number, rx: number, ry: number, alpha = 0.3): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(X(cx), Y(cy), rx * u, ry * u, 0, 0, Math.PI * 2);
  ctx.fill();
}

function treads(
  ctx: CanvasRenderingContext2D,
  X: Pt,
  Y: Pt,
  u: number,
  xs: number[],
  yTop: number,
  yBot: number,
  w: number,
  m: Motion = STILL,
): void {
  const PITCH = 4.6;
  // Sprites face up and drive forward, so the ground (and tread pattern)
  // streams backward — the scroll offset grows with distance traveled.
  const scroll = m.moving ? (m.phase * 16) % PITCH : 0;
  for (const tx of xs) {
    ctx.fillStyle = '#23252b';
    ctx.beginPath();
    ctx.roundRect(X(tx), Y(yTop), w * u, (yBot - yTop) * u, 2.5 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.1 * u;
    const n = Math.floor((yBot - yTop) / PITCH);
    for (let i = 0; i <= n; i++) {
      const yv = yTop + 1.5 + ((i * PITCH + scroll) % (n * PITCH + PITCH * 0.5));
      if (yv < yTop + 1 || yv > yBot - 1.5) continue;
      const yy = Y(yv);
      ctx.beginPath();
      ctx.moveTo(X(tx + 1), yy);
      ctx.lineTo(X(tx + w - 1), yy);
      ctx.stroke();
    }
  }
}

function hullGrad(ctx: CanvasRenderingContext2D, X: Pt, Y: Pt, col: Team, x1: number, y1: number, x2: number, y2: number): CanvasGradient {
  const g = ctx.createLinearGradient(X(x1), Y(y1), X(x2), Y(y2));
  g.addColorStop(0, col.top);
  g.addColorStop(0.55, col.mid);
  g.addColorStop(1, col.dark);
  return g;
}

function camo(ctx: CanvasRenderingContext2D, X: Pt, Y: Pt, u: number, spots: [number, number, number, number, number][]): void {
  ctx.fillStyle = 'rgba(46,54,34,0.45)';
  for (const [cx, cy, rx, ry, rot] of spots) {
    ctx.beginPath();
    ctx.ellipse(X(cx), Y(cy), rx * u, ry * u, rot, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gunBarrel(ctx: CanvasRenderingContext2D, X: Pt, Y: Pt, u: number, x1: number, y1: number, x2: number, y2: number, width: number, brake = true): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = (width + 1.3) * u;
  ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke();
  ctx.strokeStyle = GUN;
  ctx.lineWidth = width * u;
  ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke();
  if (brake) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const bx = x2 - (dx / len) * 3;
    const by = y2 - (dy / len) * 3;
    ctx.strokeStyle = GUN_DARK;
    ctx.lineWidth = (width + 1.8) * u;
    ctx.beginPath(); ctx.moveTo(X(bx), Y(by)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function soldier(
  ctx: CanvasRenderingContext2D,
  X: Pt,
  Y: Pt,
  u: number,
  cx0: number,
  cy: number,
  col: Team,
  rifle = true,
  angle = -0.35,
  m: Motion = STILL,
): void {
  // Marching: each squadmate sways on his own beat, keyed by position.
  const cx = cx0 + marchSway(m, cx0 * 1.7 + cy * 0.9);
  shadowEl(ctx, X, Y, u, cx + 0.6, cy + 1.2, 3.6, 2.2, 0.25);
  ctx.fillStyle = OLIVE.top;
  ctx.strokeStyle = OLIVE.dark;
  ctx.lineWidth = 0.9 * u;
  ctx.beginPath();
  ctx.ellipse(X(cx), Y(cy), 4.4 * u, 3.4 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (rifle) {
    ctx.strokeStyle = GUN_DARK;
    ctx.lineWidth = 1.3 * u;
    ctx.beginPath();
    ctx.moveTo(X(cx + Math.cos(angle) * 2), Y(cy + Math.sin(angle) * 2));
    ctx.lineTo(X(cx + Math.cos(angle) * 9.5), Y(cy + Math.sin(angle) * 9.5));
    ctx.stroke();
  }
  const rg = ctx.createRadialGradient(X(cx - 1), Y(cy - 1), 0.3 * u, X(cx), Y(cy), 3 * u);
  rg.addColorStop(0, '#ffffff');
  rg.addColorStop(0.35, col.top);
  rg.addColorStop(1, col.dark);
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(X(cx), Y(cy), 2.7 * u, 0, Math.PI * 2);
  ctx.fill();
}

function tankHull(ctx: CanvasRenderingContext2D, X: Pt, Y: Pt, u: number, col: Team, wide: boolean): void {
  const l = wide ? 13 : 16;
  const r = wide ? 35 : 32;
  ctx.fillStyle = hullGrad(ctx, X, Y, col, l, 6, r, 42);
  ctx.strokeStyle = col.dark;
  ctx.lineWidth = 1.4 * u;
  ctx.beginPath();
  ctx.moveTo(X(l + 1), Y(12)); ctx.lineTo(X(24), Y(6)); ctx.lineTo(X(r - 1), Y(12));
  ctx.lineTo(X(r), Y(38)); ctx.lineTo(X(r - 3), Y(42)); ctx.lineTo(X(l + 3), Y(42)); ctx.lineTo(X(l), Y(38));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 0.9 * u;
  ctx.beginPath(); ctx.moveTo(X(l + 1), Y(36)); ctx.lineTo(X(r - 1), Y(36)); ctx.stroke();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(X(20), Y(41), 3 * u, 2 * u);
  ctx.fillRect(X(25), Y(41), 3 * u, 2 * u);
}

function turretHex(ctx: CanvasRenderingContext2D, X: Pt, Y: Pt, u: number, col: Team, ty: number, r: number): void {
  const rg = ctx.createRadialGradient(X(22), Y(ty - 2), u, X(24), Y(ty), 1.3 * r * u);
  rg.addColorStop(0, '#ffffff');
  rg.addColorStop(0.22, col.top);
  rg.addColorStop(1, col.dark);
  ctx.fillStyle = rg;
  ctx.strokeStyle = col.dark;
  ctx.lineWidth = 1.4 * u;
  ctx.beginPath();
  const pts = [
    [0, -r], [0.87 * r, -r / 2], [0.87 * r, r / 2], [0, r], [-0.87 * r, r / 2], [-0.87 * r, -r / 2],
  ];
  pts.forEach(([hx, hy], i) => (i === 0 ? ctx.moveTo(X(24 + hx), Y(ty + hy)) : ctx.lineTo(X(24 + hx), Y(ty + hy))));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = col.dark;
  ctx.beginPath(); ctx.arc(X(26.5), Y(ty + 1.5), 2.2 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.arc(X(26), Y(ty + 1), u, 0, Math.PI * 2); ctx.fill();
}

type SpriteFn = (ctx: CanvasRenderingContext2D, X: Pt, Y: Pt, u: number, col: Team, m: Motion) => void;

const SPRITES: Record<Unit['type'], SpriteFn> = {
  infantry(ctx, X, Y, u, col, m) {
    soldier(ctx, X, Y, u, 24, 13, col, true, -1.9, m);
    soldier(ctx, X, Y, u, 16, 28, col, true, -0.9, m);
    soldier(ctx, X, Y, u, 31, 31, col, true, -2.3, m);
  },

  bazooka(ctx, X, Y, u, col, m) {
    shadowEl(ctx, X, Y, u, 13.5, 40, 4.5, 2.6, 0.22);
    ctx.fillStyle = '#5a5138';
    ctx.strokeStyle = '#3b3524';
    ctx.lineWidth = 0.9 * u;
    ctx.beginPath(); ctx.roundRect(X(8.5), Y(36), 10 * u, 6.5 * u, 1.2 * u); ctx.fill(); ctx.stroke();
    for (const [rx, ry] of [[10.5, 37.6], [10.5, 40.4]]) {
      ctx.strokeStyle = GUN;
      ctx.lineWidth = 1.5 * u;
      ctx.beginPath(); ctx.moveTo(X(rx), Y(ry)); ctx.lineTo(X(rx + 5.4), Y(ry)); ctx.stroke();
      ctx.strokeStyle = col.top;
      ctx.beginPath(); ctx.moveTo(X(rx + 5.4), Y(ry)); ctx.lineTo(X(rx + 6.6), Y(ry)); ctx.stroke();
    }
    soldier(ctx, X, Y, u, 30, 32, col, false, -0.35, m);
    ctx.lineCap = 'round';
    ctx.strokeStyle = GUN;
    ctx.lineWidth = 1.7 * u;
    ctx.beginPath(); ctx.moveTo(X(26), Y(35.5)); ctx.lineTo(X(33.5), Y(33)); ctx.stroke();
    ctx.strokeStyle = col.top;
    ctx.beginPath(); ctx.moveTo(X(33.5), Y(33)); ctx.lineTo(X(35.2), Y(32.4)); ctx.stroke();
    soldier(ctx, X, Y, u, 20, 19, col, false, -0.35, m);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 4.6 * u;
    ctx.beginPath(); ctx.moveTo(X(11), Y(29)); ctx.lineTo(X(31), Y(8)); ctx.stroke();
    ctx.strokeStyle = GUN;
    ctx.lineWidth = 3.2 * u;
    ctx.beginPath(); ctx.moveTo(X(11), Y(29)); ctx.lineTo(X(31), Y(8)); ctx.stroke();
    ctx.strokeStyle = GUN_DARK;
    ctx.lineWidth = 4.6 * u;
    ctx.beginPath(); ctx.moveTo(X(11), Y(29)); ctx.lineTo(X(13.2), Y(26.7)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.8 * u;
    ctx.beginPath(); ctx.moveTo(X(9.2), Y(31.5)); ctx.lineTo(X(11.5), Y(31)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(8.6), Y(29.8)); ctx.lineTo(X(10.8), Y(29.6)); ctx.stroke();
    ctx.fillStyle = '#2b2d33';
    ctx.save();
    ctx.translate(X(21.5), Y(17.2));
    ctx.rotate(-0.81);
    ctx.fillRect(-2 * u, -3.4 * u, 4 * u, 2.2 * u);
    ctx.restore();
    ctx.fillStyle = 'rgba(140,200,255,0.6)';
    ctx.beginPath(); ctx.arc(X(22.6), Y(15.2), 0.8 * u, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col.top;
    ctx.lineWidth = 4.2 * u;
    ctx.beginPath(); ctx.moveTo(X(28.2), Y(10.9)); ctx.lineTo(X(31), Y(8)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(X(27.6), Y(12.6)); ctx.lineTo(X(29.4), Y(10.8)); ctx.stroke();
    ctx.lineCap = 'butt';
  },

  recon(ctx, X, Y, u, col, _m) {
    shadowEl(ctx, X, Y, u, 25, 26, 12, 17);
    ctx.fillStyle = '#23252b';
    for (const [wx, wy] of [[12, 9], [12, 32], [30, 9], [30, 32]]) {
      ctx.beginPath(); ctx.roundRect(X(wx), Y(wy), 6 * u, 8 * u, 2 * u); ctx.fill();
    }
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 16, 6, 32, 42);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(X(18), Y(13)); ctx.lineTo(X(24), Y(5)); ctx.lineTo(X(30), Y(13));
    ctx.lineTo(X(31), Y(37)); ctx.lineTo(X(27), Y(43)); ctx.lineTo(X(21), Y(43)); ctx.lineTo(X(17), Y(37));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    camo(ctx, X, Y, u, [[21, 17, 3, 1.7, 0.5], [28, 33, 3.4, 1.8, -0.4]]);
    ctx.fillStyle = 'rgba(20,26,36,0.8)';
    ctx.beginPath(); ctx.roundRect(X(20), Y(14.5), 8 * u, 2.6 * u, 1.2 * u); ctx.fill();
    const rg = ctx.createRadialGradient(X(23), Y(25), 0.5 * u, X(24), Y(26), 4.5 * u);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.3, col.top);
    rg.addColorStop(1, col.dark);
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(X(24), Y(26), 3.8 * u, 0, Math.PI * 2); ctx.fill();
    gunBarrel(ctx, X, Y, u, 24, 24, 24, 16, 1.6, false);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.7 * u;
    ctx.beginPath(); ctx.moveTo(X(29), Y(38)); ctx.lineTo(X(33), Y(30)); ctx.stroke();
  },

  lightTank(ctx, X, Y, u, col, m) {
    shadowEl(ctx, X, Y, u, 25, 26, 14, 18);
    treads(ctx, X, Y, u, [10, 30], 5, 43, 8, m);
    tankHull(ctx, X, Y, u, col, false);
    camo(ctx, X, Y, u, [[20, 14, 3.6, 2, 0.6], [29, 37, 4, 2.2, -0.4], [18, 33, 2.8, 1.6, 0.2]]);
    gunBarrel(ctx, X, Y, u, 24, 23, 24, 4, 3.2);
    turretHex(ctx, X, Y, u, col, 27, 8);
  },

  heavyTank(ctx, X, Y, u, col, m) {
    shadowEl(ctx, X, Y, u, 25, 26, 17, 19);
    treads(ctx, X, Y, u, [6, 33], 4, 44, 9, m);
    tankHull(ctx, X, Y, u, col, true);
    camo(ctx, X, Y, u, [[18, 15, 4, 2.2, 0.6], [30, 36, 4.5, 2.4, -0.4], [17, 32, 3, 1.8, 0.2]]);
    gunBarrel(ctx, X, Y, u, 22, 22, 22, 3, 2.6);
    gunBarrel(ctx, X, Y, u, 26, 22, 26, 3, 2.6);
    turretHex(ctx, X, Y, u, col, 27, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(X(15.5), Y(14 + i * 7), 0.8 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(X(32.5), Y(14 + i * 7), 0.8 * u, 0, Math.PI * 2); ctx.fill();
    }
  },

  artillery(ctx, X, Y, u, col, m) {
    // Manned mortar pit: sandbags, baseplate, tube, loader, spotter, rounds.
    for (const [sx, sy, rot] of [[14, 12, 0.5], [20, 8.5, 0.15], [28, 8.5, -0.15], [34, 12, -0.5]]) {
      ctx.fillStyle = '#b0a074';
      ctx.strokeStyle = '#7d7150';
      ctx.lineWidth = 0.9 * u;
      ctx.beginPath(); ctx.ellipse(X(sx), Y(sy), 4.2 * u, 2.4 * u, rot, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(X(sx), Y(sy + 0.8), 3 * u, 1.2 * u, rot, 0.3, Math.PI - 0.3); ctx.stroke();
    }
    shadowEl(ctx, X, Y, u, 24.6, 24.5, 7.5, 6, 0.28);
    ctx.fillStyle = '#33353c';
    ctx.strokeStyle = '#1f2126';
    ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.arc(X(24), Y(24), 6.2 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.8 * u;
    ctx.beginPath(); ctx.arc(X(24), Y(24), 4.2 * u, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = GUN_DARK;
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath(); ctx.moveTo(X(25), Y(17.5)); ctx.lineTo(X(20), Y(21)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(25), Y(17.5)); ctx.lineTo(X(29.5), Y(20.5)); ctx.stroke();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 5 * u;
    ctx.beginPath(); ctx.moveTo(X(24), Y(24)); ctx.lineTo(X(26.4), Y(11)); ctx.stroke();
    ctx.strokeStyle = GUN;
    ctx.lineWidth = 3.8 * u;
    ctx.beginPath(); ctx.moveTo(X(24), Y(24)); ctx.lineTo(X(26.4), Y(11)); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#15161a';
    ctx.lineWidth = 1.1 * u;
    ctx.beginPath(); ctx.ellipse(X(26.4), Y(11), 2 * u, 1.2 * u, 0.18, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#15161a';
    ctx.beginPath(); ctx.ellipse(X(26.4), Y(11), 1.4 * u, 0.8 * u, 0.18, 0, Math.PI * 2); ctx.fill();
    soldier(ctx, X, Y, u, 15, 20, col, false, -0.35, m);
    ctx.lineCap = 'round';
    ctx.strokeStyle = GUN;
    ctx.lineWidth = 1.8 * u;
    ctx.beginPath(); ctx.moveTo(X(19.5), Y(17.5)); ctx.lineTo(X(24.2), Y(13.8)); ctx.stroke();
    ctx.strokeStyle = col.top;
    ctx.lineWidth = 2.4 * u;
    ctx.beginPath(); ctx.moveTo(X(24.2), Y(13.8)); ctx.lineTo(X(25.6), Y(12.6)); ctx.stroke();
    ctx.lineCap = 'butt';
    soldier(ctx, X, Y, u, 33, 30, col, false, -0.35, m);
    ctx.fillStyle = 'rgba(140,200,255,0.7)';
    ctx.beginPath(); ctx.arc(X(35.6), Y(27.6), 0.9 * u, 0, Math.PI * 2); ctx.fill();
    shadowEl(ctx, X, Y, u, 15, 39.5, 5, 2.8, 0.22);
    ctx.fillStyle = '#5a5138';
    ctx.strokeStyle = '#3b3524';
    ctx.lineWidth = 0.9 * u;
    ctx.beginPath(); ctx.roundRect(X(9.5), Y(35.5), 11 * u, 7 * u, 1.2 * u); ctx.fill(); ctx.stroke();
    for (const rx of [12, 15, 18]) {
      ctx.fillStyle = GUN;
      ctx.beginPath(); ctx.ellipse(X(rx), Y(39), 1 * u, 2.2 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col.top;
      ctx.beginPath(); ctx.arc(X(rx), Y(37.2), 1 * u, 0, Math.PI * 2); ctx.fill();
    }
  },

  antiAir(ctx, X, Y, u, col, m) {
    shadowEl(ctx, X, Y, u, 25, 26, 14, 17);
    treads(ctx, X, Y, u, [10, 30], 6, 42, 8, m);
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 15, 8, 33, 40);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath(); ctx.roundRect(X(15.5), Y(9), 17 * u, 31 * u, 3 * u); ctx.fill(); ctx.stroke();
    camo(ctx, X, Y, u, [[20, 13, 3.2, 1.8, 0.5], [28, 35, 3.4, 1.9, -0.4]]);
    for (const bx of [20.2, 22.8, 25.2, 27.8]) gunBarrel(ctx, X, Y, u, bx, 20, bx, 8, 1.7);
    ctx.fillStyle = col.dark;
    ctx.beginPath(); ctx.roundRect(X(18.5), Y(18.5), 11 * u, 7 * u, 1.6 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.roundRect(X(18.5), Y(18.5), 11 * u, 2 * u, 1.6 * u); ctx.fill();
    ctx.fillStyle = '#3a3d45';
    ctx.beginPath(); ctx.arc(X(24), Y(33), 4.6 * u, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.8 * u;
    ctx.beginPath(); ctx.arc(X(24), Y(33), 3.2 * u, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(24), Y(33)); ctx.lineTo(X(27.6), Y(30)); ctx.stroke();
  },

  helicopter(ctx, X, Y, u, col, m) {
    shadowEl(ctx, X, Y, u, 30, 36, 9, 5, 0.28);
    ctx.fillStyle = col.mid;
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.roundRect(X(21.8), Y(28), 4.4 * u, 14 * u, 2 * u); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = GUN_DARK;
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.moveTo(X(20), Y(42.5)); ctx.lineTo(X(28), Y(42.5)); ctx.stroke();
    ctx.fillStyle = col.dark;
    ctx.beginPath(); ctx.roundRect(X(12), Y(20), 24 * u, 4.4 * u, 2 * u); ctx.fill();
    ctx.fillStyle = GUN;
    ctx.beginPath(); ctx.roundRect(X(11.5), Y(19), 4 * u, 6.6 * u, 1.6 * u); ctx.fill();
    ctx.beginPath(); ctx.roundRect(X(32.5), Y(19), 4 * u, 6.6 * u, 1.6 * u); ctx.fill();
    const g = ctx.createLinearGradient(X(20), Y(8), X(28), Y(32));
    g.addColorStop(0, col.top);
    g.addColorStop(0.6, col.mid);
    g.addColorStop(1, col.dark);
    ctx.fillStyle = g;
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.3 * u;
    ctx.beginPath();
    ctx.moveTo(X(24), Y(6));
    ctx.quadraticCurveTo(X(29.5), Y(12), X(28.5), Y(24));
    ctx.quadraticCurveTo(X(27.5), Y(31), X(24), Y(31));
    ctx.quadraticCurveTo(X(20.5), Y(31), X(19.5), Y(24));
    ctx.quadraticCurveTo(X(18.5), Y(12), X(24), Y(6));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(24,34,48,0.85)';
    ctx.beginPath();
    ctx.moveTo(X(24), Y(8.5));
    ctx.quadraticCurveTo(X(27), Y(12), X(26.5), Y(16));
    ctx.lineTo(X(21.5), Y(16));
    ctx.quadraticCurveTo(X(21), Y(12), X(24), Y(8.5));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(X(23), Y(11.5), 1.2 * u, 2 * u, 0.3, 0, Math.PI * 2); ctx.fill();
    // Rotor: the blur disc thickens in flight and the blades spin with
    // distance traveled, so faster runs read as faster rotors.
    ctx.strokeStyle = m.moving ? 'rgba(30,30,30,0.34)' : 'rgba(30,30,30,0.25)';
    ctx.lineWidth = (m.moving ? 3 : 2.2) * u;
    ctx.beginPath(); ctx.arc(X(24), Y(20), 15 * u, 0, Math.PI * 2); ctx.stroke();
    const spin = m.moving ? m.phase * 22 : 0;
    ctx.strokeStyle = m.moving ? 'rgba(25,25,25,0.55)' : 'rgba(25,25,25,0.75)';
    ctx.lineWidth = 1.5 * u;
    for (const a of [0.4 + spin, 2.5 + spin, 4.6 + spin]) {
      ctx.beginPath();
      ctx.moveTo(X(24), Y(20));
      ctx.lineTo(X(24 + Math.cos(a) * 15), Y(20 + Math.sin(a) * 15));
      ctx.stroke();
    }
    ctx.fillStyle = '#1e1e22';
    ctx.beginPath(); ctx.arc(X(24), Y(20), 1.8 * u, 0, Math.PI * 2); ctx.fill();
  },
};

function drawUnit(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  unit: Unit,
  x: number,
  y: number,
  selected: boolean,
  facing: number,
  motion: Motion = STILL,
): void {
  const px = x * TILE;
  const py = y * TILE;
  const acted = unit.acted && unit.owner === state.current;

  ctx.save();
  if (acted) ctx.filter = 'grayscale(70%) brightness(0.8)';
  ctx.translate(px + TILE / 2, py + TILE / 2);
  ctx.rotate(facing);
  ctx.translate(-TILE / 2, -TILE / 2);
  const u = TILE / 48;
  const X: Pt = (v) => v * u;
  const Y: Pt = (v) => v * u;
  SPRITES[unit.type](ctx, X, Y, u, PLAYER_COLORS[unit.owner], motion);
  ctx.restore();

  // HP badge when damaged (screen-aligned, not rotated).
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
    ctx.beginPath();
    ctx.roundRect(px + 2, py + 2, TILE - 4, TILE - 4, 8);
    ctx.stroke();
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = 'rgba(255, 80, 50, 0.30)';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = '#ff5232';
  ctx.lineWidth = 3;
  const g = 7;
  const s = 13;
  ctx.beginPath();
  ctx.moveTo(px + g, py + g + s); ctx.lineTo(px + g, py + g); ctx.lineTo(px + g + s, py + g);
  ctx.moveTo(px + TILE - g - s, py + g); ctx.lineTo(px + TILE - g, py + g); ctx.lineTo(px + TILE - g, py + g + s);
  ctx.moveTo(px + TILE - g, py + TILE - g - s); ctx.lineTo(px + TILE - g, py + TILE - g); ctx.lineTo(px + TILE - g - s, py + TILE - g);
  ctx.moveTo(px + g + s, py + TILE - g); ctx.lineTo(px + g, py + TILE - g); ctx.lineTo(px + g, py + TILE - g - s);
  ctx.stroke();
}
