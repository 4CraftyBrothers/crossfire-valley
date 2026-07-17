import { DAMAGE, TERRAIN_DATA, UNIT_DATA } from './data';
import { manhattan } from './movement';
import { tileAt, visualHp } from './state';
import type { GameState, Unit } from './types';

/**
 * Hit points (0-100 scale) the attacker removes from the defender.
 * Advance Wars-style: scales with attacker health, reduced by the
 * defender's terrain stars (weighted by the defender's remaining health).
 */
export function computeDamage(state: GameState, attacker: Unit, defender: Unit): number {
  const base = DAMAGE[attacker.type][defender.type];
  const stars = TERRAIN_DATA[tileAt(state, defender.x, defender.y).terrain].defenseStars;
  const attackScale = attacker.hp / 100;
  const defenseScale = (100 - stars * visualHp(defender)) / 100;
  return Math.max(0, Math.round(base * attackScale * defenseScale));
}

export function isIndirect(unit: Unit): boolean {
  return UNIT_DATA[unit.type].minRange > 1;
}

/**
 * Enemy units this unit could attack if it were standing at (x, y),
 * given whether it moved this turn (indirect units can't move and fire).
 */
export function attackableTargets(
  state: GameState,
  unit: Unit,
  x: number,
  y: number,
  moved: boolean,
): Unit[] {
  const data = UNIT_DATA[unit.type];
  if (moved && isIndirect(unit)) return [];
  return state.units.filter((target) => {
    if (target.owner === unit.owner) return false;
    const d = manhattan(x, y, target.x, target.y);
    return d >= data.minRange && d <= data.maxRange;
  });
}

/** Whether the defender fires back after surviving an attack. */
export function canCounter(attacker: Unit, defender: Unit): boolean {
  if (defender.hp <= 0) return false;
  if (isIndirect(attacker) || isIndirect(defender)) return false;
  return manhattan(attacker.x, attacker.y, defender.x, defender.y) === 1;
}
