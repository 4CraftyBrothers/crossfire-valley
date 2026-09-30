import { CAPTURE_POINTS, modsOf } from '../engine/data';
import { tileAt, unitById, visualHp } from '../engine/state';
import type { GameState, PlayerId, Tile, Unit } from '../engine/types';

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
  /** Tiles outlined for tutorial guidance ("x,y" keys). */
  highlight?: Set<string>;
  /** An inspected unit's next-turn reach: move tiles shaded, attack area outlined. */
  threat?: { move: Set<string>; attack: Set<string> };
}

function drawThreat(ctx: CanvasRenderingContext2D, threat: { move: Set<string>; attack: Set<string> }): void {
  for (const k of threat.attack) {
    const [x, y] = k.split(',').map(Number);
    ctx.fillStyle = threat.move.has(k) ? 'rgba(216, 68, 46, 0.34)' : 'rgba(216, 68, 46, 0.16)';
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
  }
  // Tiles it can move to but not shoot from/at (indirect units' walk area).
  ctx.fillStyle = 'rgba(216, 68, 46, 0.24)';
  for (const k of threat.move) {
    if (threat.attack.has(k)) continue;
    const [x, y] = k.split(',').map(Number);
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
  }
  // Outline the edge of the danger zone.
  ctx.strokeStyle = 'rgba(255, 96, 70, 0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const k of threat.attack) {
    const [x, y] = k.split(',').map(Number);
    const px = x * TILE;
    const py = y * TILE;
    if (!threat.attack.has(`${x},${y - 1}`)) { ctx.moveTo(px, py + 1); ctx.lineTo(px + TILE, py + 1); }
    if (!threat.attack.has(`${x},${y + 1}`)) { ctx.moveTo(px, py + TILE - 1); ctx.lineTo(px + TILE, py + TILE - 1); }
    if (!threat.attack.has(`${x - 1},${y}`)) { ctx.moveTo(px + 1, py); ctx.lineTo(px + 1, py + TILE); }
    if (!threat.attack.has(`${x + 1},${y}`)) { ctx.moveTo(px + TILE - 1, py); ctx.lineTo(px + TILE - 1, py + TILE); }
  }
  ctx.stroke();
}

/** Display options that aren't game state. */
const renderOptions = { teamMarkers: false };

export function setRenderOptions(opts: Partial<typeof renderOptions>): void {
  Object.assign(renderOptions, opts);
}

/**
 * Team shape for colour-blind players: Red is a triangle, Blue a square,
 * in white with a dark outline so it reads on any tile.
 */
function drawTeamMark(ctx: CanvasRenderingContext2D, x: number, y: number, owner: PlayerId): void {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(10, 14, 20, 0.9)';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (owner === 'red') {
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 10, y + 9);
    ctx.lineTo(x, y + 9);
    ctx.closePath();
  } else {
    ctx.rect(x + 0.5, y + 0.5, 8.5, 8.5);
  }
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

/**
 * A warship seen from above, bow up. `len` and `beam` in sprite units; each
 * turret sits on the centreline at `at` from the top.
 */
function ship(
  ctx: CanvasRenderingContext2D,
  X: Pt,
  Y: Pt,
  u: number,
  col: Team,
  spec: { len: number; beam: number; turrets: { at: number; size: number; twin?: boolean }[]; bridge: number; radar?: boolean },
): void {
  const top = 24 - spec.len / 2;
  const bot = 24 + spec.len / 2;
  const half = spec.beam / 2;
  // Wake and shadow.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(X(24), Y(bot), half * u, 2.5 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(X(25.5), Y(25.5), (half + 1) * u, (spec.len / 2) * u, 0, 0, Math.PI * 2); ctx.fill();
  // Hull: pointed bow, square stern.
  ctx.fillStyle = hullGrad(ctx, X, Y, col, 24 - half, top, 24 + half, bot);
  ctx.strokeStyle = col.dark;
  ctx.lineWidth = 1.3 * u;
  ctx.beginPath();
  ctx.moveTo(X(24), Y(top));
  ctx.quadraticCurveTo(X(24 + half), Y(top + spec.len * 0.25), X(24 + half), Y(top + spec.len * 0.5));
  ctx.lineTo(X(24 + half * 0.8), Y(bot));
  ctx.lineTo(X(24 - half * 0.8), Y(bot));
  ctx.lineTo(X(24 - half), Y(top + spec.len * 0.5));
  ctx.quadraticCurveTo(X(24 - half), Y(top + spec.len * 0.25), X(24), Y(top));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Deck line.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.8 * u;
  ctx.beginPath(); ctx.moveTo(X(24), Y(top + 3)); ctx.lineTo(X(24), Y(bot - 2)); ctx.stroke();
  // Bridge block.
  ctx.fillStyle = col.dark;
  ctx.beginPath(); ctx.roundRect(X(24 - half * 0.5), Y(spec.bridge), spec.beam * 0.5 * u, 6 * u, 1.5 * u); ctx.fill();
  ctx.fillStyle = 'rgba(24,34,48,0.85)';
  ctx.fillRect(X(24 - half * 0.35), Y(spec.bridge + 0.8), spec.beam * 0.35 * u, 1.6 * u);
  if (spec.radar) {
    ctx.strokeStyle = '#d8dde5';
    ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.arc(X(24), Y(spec.bridge + 3), 2.2 * u, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  for (const t of spec.turrets) {
    ctx.fillStyle = GUN;
    ctx.beginPath(); ctx.arc(X(24), Y(top + t.at), t.size * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = GUN_DARK;
    const barrels = t.twin ? [-1.2, 1.2] : [0];
    for (const dx of barrels) ctx.fillRect(X(24 + dx - 0.6), Y(top + t.at - t.size - 4), 1.2 * u, (t.size + 2) * u);
  }
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
      const owner = tileAt(state, x, y).owner;
      if (renderOptions.teamMarkers && owner) drawTeamMark(ctx, x * TILE + TILE - 13, y * TILE + 3, owner);
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

  if (ov.threat) drawThreat(ctx, ov.threat);

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

  if (ov.highlight) {
    const lw = ctx.lineWidth;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 210, 62, 0.95)';
    for (const k of ov.highlight) {
      const [x, y] = k.split(',').map(Number);
      ctx.strokeRect(x * TILE + 2.5, y * TILE + 2.5, TILE - 5, TILE - 5);
    }
    ctx.lineWidth = lw;
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
    case 'refinery':
      drawBuilding(ctx, px, py, tile, 'refinery');
      // Upgrade tier: one gold pip per level above the first.
      for (let i = 1; i < (tile.level ?? 1); i++) {
        ctx.fillStyle = '#ffd23e';
        ctx.strokeStyle = 'rgba(10,14,20,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px + 7 + (i - 1) * 7, py + TILE - 6, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'airbase':
      drawBuilding(ctx, px, py, tile, 'airbase');
      break;
    case 'rig': {
      ctx.fillStyle = checker ? '#5f8fb4' : '#5a89ad';
      ctx.fillRect(px, py, TILE, TILE);
      const c = ownerColors(tile);
      // Legs, deck, derrick, and a flare.
      ctx.fillStyle = '#3d4450';
      for (const [lx, ly] of [[12, 30], [34, 30], [12, 40], [34, 40]]) ctx.fillRect(px + lx, py + ly - 6, 3, 8);
      ctx.fillStyle = c.top;
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = 2;
      ctx.fillRect(px + 9, py + 20, 30, 12);
      ctx.strokeRect(px + 9, py + 20, 30, 12);
      ctx.strokeStyle = '#d8dde5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 16, py + 20); ctx.lineTo(px + 20, py + 5); ctx.lineTo(px + 24, py + 20);
      ctx.moveTo(px + 17, py + 14); ctx.lineTo(px + 23, py + 14);
      ctx.stroke();
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath(); ctx.ellipse(px + 35, py + 14, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'port': {
      // Water under the dock so ships read as able to berth here.
      ctx.fillStyle = checker ? '#5f8fb4' : '#5a89ad';
      ctx.fillRect(px, py + TILE / 2, TILE, TILE / 2);
      drawBuilding(ctx, px, py, tile, 'port');
      break;
    }
    case 'shore': {
      ctx.fillStyle = checker ? '#c9b98a' : '#c2b283';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (const [fx, fy] of [[0.2, 0.3], [0.6, 0.7], [0.8, 0.25]]) ctx.fillRect(px + fx * TILE, py + fy * TILE, 3, 2);
      break;
    }
    case 'shallow': {
      ctx.fillStyle = checker ? '#6f9fbf' : '#6798b8';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px + TILE * 0.3, py + TILE * 0.4, 5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.arc(px + TILE * 0.7, py + TILE * 0.65, 4, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    case 'bridge': {
      ctx.fillStyle = checker ? '#6f9fbf' : '#6798b8';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#8b7a58';
      ctx.fillRect(px, py + 8, TILE, TILE - 16);
      ctx.fillStyle = '#5e4f34';
      ctx.fillRect(px, py + 8, TILE, 3);
      ctx.fillRect(px, py + TILE - 11, TILE, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 4; i < TILE; i += 8) ctx.fillRect(px + i, py + 12, 1, TILE - 24);
      break;
    }
    case 'volcano': {
      const mx = px + TILE / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(mx + 2, py + TILE - 7, TILE * 0.4, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a3d3a';
      ctx.beginPath();
      ctx.moveTo(px + 5, py + TILE - 6); ctx.lineTo(mx - 6, py + 10); ctx.lineTo(mx + 6, py + 10); ctx.lineTo(px + TILE - 5, py + TILE - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a2f2d';
      ctx.beginPath();
      ctx.moveTo(mx + 6, py + 10); ctx.lineTo(px + TILE - 5, py + TILE - 6); ctx.lineTo(mx + 2, py + TILE - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff6a2a';
      ctx.beginPath();
      ctx.ellipse(mx, py + 10, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.ellipse(mx, py + 10, 3, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
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
  kind: 'city' | 'factory' | 'hq' | 'refinery' | 'airbase' | 'port',
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
  } else if (kind === 'airbase') {
    // Hangar with a curved roof and a strip of runway.
    ctx.fillStyle = '#4a4d55';
    ctx.fillRect(px + 3, py + TILE - 12, TILE - 6, 6);
    ctx.fillStyle = '#e8e4da';
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 7 + i * 10, py + TILE - 9.5, 5, 1.2);
    ctx.fillStyle = c.top;
    ctx.beginPath();
    ctx.moveTo(bx, by + h - 6);
    ctx.lineTo(bx, by + 8);
    ctx.quadraticCurveTo(bx + w / 2, by - 6, bx + w, by + 8);
    ctx.lineTo(bx + w, by + h - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(bx + w / 2 - 6, by + 8, 12, h - 14);
  } else if (kind === 'port') {
    // A pier on the waterline with a crane.
    ctx.fillStyle = c.top;
    ctx.fillRect(bx, by + 4, w, h / 2);
    ctx.strokeRect(bx, by + 4, w, h / 2);
    ctx.fillStyle = '#6e5a3e';
    ctx.fillRect(bx + 4, by + 4 + h / 2, 5, h / 2 - 2);
    ctx.fillRect(bx + w - 9, by + 4 + h / 2, 5, h / 2 - 2);
    ctx.strokeStyle = '#e0b43c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + w - 6, by + 4);
    ctx.lineTo(bx + w - 6, by - 8);
    ctx.lineTo(bx + 6, by - 4);
    ctx.stroke();
    ctx.strokeStyle = c.dark;
  } else if (kind === 'refinery') {
    // Two storage tanks and a flare stack.
    for (const tx of [bx + 8, bx + w - 8]) {
      ctx.beginPath();
      ctx.arc(tx, by + h / 2 + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(tx - 2, by + h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.top;
    }
    ctx.fillStyle = '#4a4d55';
    ctx.fillRect(bx + w / 2 - 2, by - 6, 4, h + 4);
    ctx.fillStyle = '#ff9a3c';
    ctx.beginPath();
    ctx.ellipse(bx + w / 2, by - 8, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
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

  stealthTank(ctx, X, Y, u, col, m) {
    // Faceted, low hull with a flat angular turret.
    shadowEl(ctx, X, Y, u, 25, 26, 14, 18);
    treads(ctx, X, Y, u, [10, 30], 5, 43, 8, m);
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 14, 8, 34, 42);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.3 * u;
    ctx.beginPath();
    ctx.moveTo(X(24), Y(7)); ctx.lineTo(X(33), Y(14)); ctx.lineTo(X(33), Y(38));
    ctx.lineTo(X(28), Y(43)); ctx.lineTo(X(20), Y(43)); ctx.lineTo(X(15), Y(38)); ctx.lineTo(X(15), Y(14));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.8 * u;
    ctx.beginPath(); ctx.moveTo(X(24), Y(7)); ctx.lineTo(X(24), Y(43)); ctx.moveTo(X(15), Y(14)); ctx.lineTo(X(33), Y(38)); ctx.stroke();
    gunBarrel(ctx, X, Y, u, 24, 22, 24, 5, 2.6);
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.moveTo(X(24), Y(17)); ctx.lineTo(X(30), Y(24)); ctx.lineTo(X(24), Y(31)); ctx.lineTo(X(18), Y(24));
    ctx.closePath(); ctx.fill();
  },

  rocketTruck(ctx, X, Y, u, col) {
    // Six-wheeled truck with a boxy launcher on the back.
    shadowEl(ctx, X, Y, u, 25, 26, 11, 19, 0.26);
    ctx.fillStyle = '#26272c';
    for (const wy of [12, 26, 36]) {
      ctx.fillRect(X(13), Y(wy), 3.4 * u, 6 * u);
      ctx.fillRect(X(31.6), Y(wy), 3.4 * u, 6 * u);
    }
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 15, 6, 33, 42);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.roundRect(X(15.5), Y(6), 17 * u, 10 * u, 2.5 * u); ctx.fill(); ctx.stroke(); // cab
    ctx.fillStyle = 'rgba(24,34,48,0.85)';
    ctx.fillRect(X(17.5), Y(7.5), 13 * u, 3 * u);
    ctx.fillStyle = OLIVE.top;
    ctx.strokeStyle = OLIVE.dark;
    ctx.beginPath(); ctx.roundRect(X(15), Y(18), 18 * u, 23 * u, 2 * u); ctx.fill(); ctx.stroke(); // launcher box
    ctx.fillStyle = '#1b1c20';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      ctx.beginPath(); ctx.arc(X(19 + c * 5), Y(23 + r * 6), 1.5 * u, 0, Math.PI * 2); ctx.fill();
    }
  },
  fighter(ctx, X, Y, u, col) {
    // Delta-wing jet, nose up.
    shadowEl(ctx, X, Y, u, 28, 32, 12, 6, 0.22);
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 10, 6, 38, 42);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.moveTo(X(24), Y(4)); ctx.lineTo(X(27), Y(18)); ctx.lineTo(X(40), Y(34)); ctx.lineTo(X(27), Y(33));
    ctx.lineTo(X(29), Y(42)); ctx.lineTo(X(19), Y(42)); ctx.lineTo(X(21), Y(33)); ctx.lineTo(X(8), Y(34));
    ctx.lineTo(X(21), Y(18)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(24,34,48,0.85)';
    ctx.beginPath(); ctx.ellipse(X(24), Y(15), 1.8 * u, 4 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(X(23.4), Y(13.5), 0.6 * u, 1.6 * u, 0, 0, Math.PI * 2); ctx.fill();
  },
  bomber(ctx, X, Y, u, col) {
    // Broad swept wing and a long fuselage.
    shadowEl(ctx, X, Y, u, 28, 30, 18, 8, 0.22);
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 4, 8, 44, 40);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.3 * u;
    ctx.beginPath();
    ctx.moveTo(X(24), Y(6)); ctx.lineTo(X(44), Y(28)); ctx.lineTo(X(40), Y(31)); ctx.lineTo(X(27), Y(26));
    ctx.lineTo(X(28), Y(38)); ctx.lineTo(X(33), Y(42)); ctx.lineTo(X(15), Y(42)); ctx.lineTo(X(20), Y(38));
    ctx.lineTo(X(21), Y(26)); ctx.lineTo(X(8), Y(31)); ctx.lineTo(X(4), Y(28)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col.dark;
    for (const ex of [14, 34]) { ctx.beginPath(); ctx.ellipse(X(ex), Y(22), 1.6 * u, 3 * u, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(24,34,48,0.85)';
    ctx.beginPath(); ctx.ellipse(X(24), Y(11), 2 * u, 3 * u, 0, 0, Math.PI * 2); ctx.fill();
  },
  turret(ctx, X, Y, u, col) {
    // A round concrete bunker with a long gun.
    shadowEl(ctx, X, Y, u, 26, 27, 16, 15, 0.3);
    ctx.fillStyle = '#8a8578';
    ctx.strokeStyle = '#55524a';
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath(); ctx.arc(X(24), Y(25), 15 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(X(24 + Math.cos(a) * 11), Y(25 + Math.sin(a) * 11)); ctx.lineTo(X(24 + Math.cos(a) * 15), Y(25 + Math.sin(a) * 15)); ctx.stroke();
    }
    gunBarrel(ctx, X, Y, u, 24, 20, 24, 2, 3);
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 16, 17, 32, 33);
    ctx.strokeStyle = col.dark;
    ctx.beginPath(); ctx.arc(X(24), Y(25), 8 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
  skylift(ctx, X, Y, u, col, m) {
    // Tandem-rotor lifter: a long boxy body with a rotor at each end.
    shadowEl(ctx, X, Y, u, 28, 36, 12, 5, 0.26);
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 18, 8, 30, 40);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.3 * u;
    ctx.beginPath(); ctx.roundRect(X(18.5), Y(8), 11 * u, 32 * u, 5 * u); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(24,34,48,0.85)';
    ctx.beginPath(); ctx.roundRect(X(20.5), Y(10), 7 * u, 5 * u, 2 * u); ctx.fill();
    ctx.fillStyle = col.dark;
    for (let i = 0; i < 3; i++) ctx.fillRect(X(20), Y(19 + i * 5), 8 * u, 1.2 * u);
    const spin = m.moving ? m.phase * 22 : 0;
    for (const [cy, off] of [[12, 0], [36, 1.1]] as const) {
      ctx.strokeStyle = m.moving ? 'rgba(30,30,30,0.3)' : 'rgba(30,30,30,0.22)';
      ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(X(24), Y(cy), 11 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(25,25,25,0.7)';
      ctx.lineWidth = 1.3 * u;
      for (const a of [off + spin, off + spin + 2.1, off + spin + 4.2]) {
        ctx.beginPath();
        ctx.moveTo(X(24), Y(cy));
        ctx.lineTo(X(24 + Math.cos(a) * 11), Y(cy + Math.sin(a) * 11));
        ctx.stroke();
      }
      ctx.fillStyle = '#1e1e22';
      ctx.beginPath(); ctx.arc(X(24), Y(cy), 1.5 * u, 0, Math.PI * 2); ctx.fill();
    }
  },
  cutter(ctx, X, Y, u, col) {
    ship(ctx, X, Y, u, col, { len: 30, beam: 10, turrets: [{ at: 14, size: 3 }], bridge: 26 });
  },
  frigate(ctx, X, Y, u, col) {
    ship(ctx, X, Y, u, col, { len: 34, beam: 11, turrets: [{ at: 12, size: 3.5 }], bridge: 22, radar: true });
    // A twin anti-air mount aft.
    ctx.fillStyle = GUN_DARK;
    ctx.fillRect(X(21.5), Y(33), 1.6 * u, 4 * u);
    ctx.fillRect(X(24.9), Y(33), 1.6 * u, 4 * u);
  },
  destroyer(ctx, X, Y, u, col) {
    ship(ctx, X, Y, u, col, { len: 38, beam: 13, turrets: [{ at: 11, size: 4.5 }, { at: 34, size: 4 }], bridge: 21 });
  },
  submarine(ctx, X, Y, u, col) {
    // A long dark cigar with a sail; half under the waterline.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(X(25), Y(25), 7 * u, 19 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 18, 6, 30, 42);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.ellipse(X(24), Y(24), 5.5 * u, 18 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = col.dark;
    ctx.beginPath(); ctx.roundRect(X(21.5), Y(15), 5 * u, 9 * u, 2 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(X(19), Y(44)); ctx.quadraticCurveTo(X(24), Y(40), X(29), Y(44)); ctx.stroke();
  },
  cruiser(ctx, X, Y, u, col) {
    ship(ctx, X, Y, u, col, { len: 42, beam: 14, turrets: [{ at: 10, size: 4.5, twin: true }, { at: 35, size: 4.5, twin: true }], bridge: 21, radar: true });
  },
  barge(ctx, X, Y, u, col) {
    // Flat landing barge: blunt ramp at the bow, open deck, wheelhouse aft.
    shadowEl(ctx, X, Y, u, 24, 26, 15, 18, 0.18);
    ctx.fillStyle = hullGrad(ctx, X, Y, col, 10, 6, 38, 42);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(X(12), Y(7)); ctx.lineTo(X(36), Y(7)); ctx.lineTo(X(37), Y(38));
    ctx.quadraticCurveTo(X(24), Y(44), X(11), Y(38));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(X(15), Y(11), 18 * u, 19 * u);
    ctx.fillStyle = OLIVE.top;
    ctx.fillRect(X(12), Y(5), 24 * u, 3 * u); // bow ramp
    ctx.fillStyle = col.dark;
    ctx.beginPath(); ctx.roundRect(X(18), Y(31), 12 * u, 7 * u, 1.5 * u); ctx.fill();
    ctx.fillStyle = 'rgba(24,34,48,0.85)';
    ctx.fillRect(X(20), Y(32.5), 8 * u, 2 * u);
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
  // Cloaked units shimmer: drawn see-through wherever they are shown.
  if (modsOf(unit.type).cloak) ctx.globalAlpha = 0.55;
  ctx.translate(px + TILE / 2, py + TILE / 2);
  ctx.rotate(facing);
  ctx.translate(-TILE / 2, -TILE / 2);
  const u = TILE / 48;
  const X: Pt = (v) => v * u;
  const Y: Pt = (v) => v * u;
  SPRITES[unit.type](ctx, X, Y, u, PLAYER_COLORS[unit.owner], motion);
  ctx.restore();

  if (renderOptions.teamMarkers) drawTeamMark(ctx, px + 3, py + 3, unit.owner);

  // Passengers aboard: a small count badge, bottom-left.
  const riders = unit.cargo?.length ?? 0;
  if (riders > 0) {
    ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
    ctx.beginPath();
    ctx.roundRect(px + 2, py + TILE - 15, 13, 13, 3);
    ctx.fill();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText(String(riders), px + 8.5, py + TILE - 8);
  }

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
