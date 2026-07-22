import { TERRAIN_DATA, UNIT_DATA } from './data';
import { inBounds, tileAt, unitAt } from './state';
import { canSeeUnit, visibleTiles } from './vision';
import type { GameState, Unit } from './types';

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

interface DijkstraResult {
  best: Map<string, number>;
  parent: Map<string, string>;
}

/**
 * Movement search shared by range display and path reconstruction.
 * Blocking rules: visible enemies block ground movement; enemies the
 * mover's side can't see (fog/forest) do NOT block — walking into one
 * triggers an ambush at execution time. Aircraft fly over everything.
 */
function dijkstra(state: GameState, unit: Unit): DijkstraResult {
  const data = UNIT_DATA[unit.type];
  const air = data.moveClass === 'air';
  const sight = state.fog ? visibleTiles(state, unit.owner) : null;
  const best = new Map<string, number>();
  const parent = new Map<string, string>();
  best.set(key(unit.x, unit.y), 0);
  const frontier: { x: number; y: number; cost: number }[] = [{ x: unit.x, y: unit.y, cost: 0 }];

  while (frontier.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[bestIdx].cost) bestIdx = i;
    }
    const { x, y, cost } = frontier.splice(bestIdx, 1)[0];
    if (cost > (best.get(key(x, y)) ?? Infinity)) continue;

    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(state, nx, ny)) continue;
      const stepCost = TERRAIN_DATA[tileAt(state, nx, ny).terrain].moveCost[data.moveClass];
      if (stepCost === null) continue;
      const occupant = unitAt(state, nx, ny);
      if (occupant && occupant.owner !== unit.owner && !air) {
        const seen = !state.fog || canSeeUnit(state, unit.owner, occupant, sight ?? undefined);
        if (seen) continue; // visible enemies block; hidden ones ambush later
      }
      const total = cost + stepCost;
      if (total > data.move) continue;
      const k = key(nx, ny);
      if (total < (best.get(k) ?? Infinity)) {
        best.set(k, total);
        parent.set(k, key(x, y));
        frontier.push({ x: nx, y: ny, cost: total });
      }
    }
  }

  return { best, parent };
}

/**
 * All tiles the unit can END its move on, mapped by "x,y" to movement
 * cost. Friendly units can be passed through but not stopped on; tiles
 * held by enemies the mover can't see stay selectable (ambush bait).
 * Always includes the unit's own tile.
 */
export function reachableTiles(state: GameState, unit: Unit): Map<string, number> {
  const { best } = dijkstra(state, unit);
  const sight = state.fog ? visibleTiles(state, unit.owner) : null;

  for (const k of [...best.keys()]) {
    const [x, y] = k.split(',').map(Number);
    const occupant = unitAt(state, x, y);
    if (!occupant || occupant.id === unit.id) continue;
    if (occupant.owner === unit.owner) {
      best.delete(k);
    } else if (!state.fog || canSeeUnit(state, unit.owner, occupant, sight ?? undefined)) {
      best.delete(k);
    }
  }

  return best;
}

/**
 * Cheapest tile-by-tile path from the unit to a destination it can reach,
 * including both endpoints. Returns null if the destination is unreachable.
 */
export function pathBetween(
  state: GameState,
  unit: Unit,
  to: { x: number; y: number },
): { x: number; y: number }[] | null {
  const { best, parent } = dijkstra(state, unit);
  const destKey = key(to.x, to.y);
  if (!best.has(destKey)) return null;
  const path: { x: number; y: number }[] = [];
  let cursor: string | undefined = destKey;
  while (cursor) {
    const [x, y] = cursor.split(',').map(Number);
    path.unshift({ x, y });
    cursor = parent.get(cursor);
  }
  return path;
}

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}