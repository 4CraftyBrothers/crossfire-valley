import { TERRAIN_DATA, UNIT_DATA } from './data';
import { inBounds, tileAt, unitAt } from './state';
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

/**
 * All tiles the unit can END its move on, mapped by "x,y" to remaining
 * movement cost. Friendly units can be passed through but not stopped on;
 * enemy units block movement entirely. Always includes the unit's own tile.
 */
export function reachableTiles(state: GameState, unit: Unit): Map<string, number> {
  const data = UNIT_DATA[unit.type];
  // Dijkstra over the grid; movement budgets are small so a simple
  // priority-by-scan approach is plenty fast.
  const best = new Map<string, number>();
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
      if (occupant && occupant.owner !== unit.owner) continue; // enemies block
      const total = cost + stepCost;
      if (total > data.move) continue;
      const k = key(nx, ny);
      if (total < (best.get(k) ?? Infinity)) {
        best.set(k, total);
        frontier.push({ x: nx, y: ny, cost: total });
      }
    }
  }

  // Can't stop on top of another unit (own tile is fine).
  for (const k of [...best.keys()]) {
    const [x, y] = k.split(',').map(Number);
    const occupant = unitAt(state, x, y);
    if (occupant && occupant.id !== unit.id) best.delete(k);
  }

  return best;
}

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * Cheapest tile-by-tile path from the unit to a destination it can reach,
 * including both endpoints. Returns null if the destination is unreachable.
 * Used by the UI to animate movement along the route the unit would take.
 */
export function pathBetween(
  state: GameState,
  unit: Unit,
  to: { x: number; y: number },
): { x: number; y: number }[] | null {
  const data = UNIT_DATA[unit.type];
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
      if (occupant && occupant.owner !== unit.owner) continue;
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
