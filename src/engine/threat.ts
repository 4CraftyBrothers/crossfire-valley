import { TERRAIN_DATA, UNIT_DATA } from './data';
import { key, reachableTiles } from './movement';
import { inBounds, tileAt } from './state';
import type { GameState, Unit } from './types';

/** Where a unit could go next turn, and every tile it could fire on. */
export interface ThreatArea {
  move: Set<string>;
  attack: Set<string>;
}

/**
 * A unit's reach on its owner's next turn. Direct units can attack from
 * any tile they can reach; indirect units can't move and fire, so their
 * attack area is measured from where they stand now.
 */
export function threatArea(state: GameState, unit: Unit): ThreatArea {
  const data = UNIT_DATA[unit.type];
  const move = new Set(reachableTiles(state, unit).keys());
  const attack = new Set<string>();
  const indirect = data.minRange > 1;
  if (indirect && TERRAIN_DATA[tileAt(state, unit.x, unit.y).terrain].canopy) return { move, attack };
  const origins = indirect ? [key(unit.x, unit.y)] : [...move];
  for (const origin of origins) {
    const [ox, oy] = origin.split(',').map(Number);
    for (let dy = -data.maxRange; dy <= data.maxRange; dy++) {
      for (let dx = -data.maxRange; dx <= data.maxRange; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < data.minRange || d > data.maxRange) continue;
        if (inBounds(state, ox + dx, oy + dy)) attack.add(key(ox + dx, oy + dy));
      }
    }
  }
  return { move, attack };
}
