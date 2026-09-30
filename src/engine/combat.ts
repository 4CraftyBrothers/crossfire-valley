import { DAMAGE, HIGH_GROUND_REDUCTION, TERRAIN_DATA, UNIT_DATA, modsOf } from './data';
import { manhattan } from './movement';
import { tileAt, visualHp } from './state';
import { canSeeUnit, detectedBy, isAir, isCloaked, unitVision, visibleTiles } from './vision';
import type { GameState, Unit } from './types';

/**
 * Hit points (0-100 scale) the attacker removes from the defender.
 * Advance Wars-style: scales with attacker health, reduced by the
 * defender's terrain stars (weighted by the defender's remaining health).
 * Aircraft fly above the terrain and get no defensive cover from it.
 * `counter` selects the attacker's counter-attack modifiers (mammoth,
 * courage) instead of its initiative modifier (blitz).
 */
export function computeDamage(state: GameState, attacker: Unit, defender: Unit, counter = false): number {
  const base = DAMAGE[attacker.type][defender.type];
  const tile = TERRAIN_DATA[tileAt(state, defender.x, defender.y).terrain];
  const stars = isAir(defender) ? 0 : tile.defenseStars;
  const attackScale = attacker.hp / 100;
  const defenseScale = (100 - stars * visualHp(defender)) / 100;
  const m = modsOf(attacker.type);
  let mult = 1 + (counter ? (m.courage ?? 0) - (m.mammoth ?? 0) : (m.blitz ?? 0));
  if (tile.highGround && isIndirect(attacker) && !isAir(defender)) mult -= HIGH_GROUND_REDUCTION;
  return Math.max(0, Math.round(base * attackScale * defenseScale * mult));
}

export function isIndirect(unit: Unit): boolean {
  return UNIT_DATA[unit.type].minRange > 1;
}

/**
 * Enemy units this unit could attack if it were standing at (x, y),
 * given whether it moved this turn (indirect units can't move and fire).
 * Under fog of war, only targets the attacker's side can see — through
 * the attacker's own sight from (x, y), or any allied unit/property.
 */
export function attackableTargets(
  state: GameState,
  unit: Unit,
  x: number,
  y: number,
  moved: boolean,
): Unit[] {
  const data = UNIT_DATA[unit.type];
  const mods = modsOf(unit.type);
  if (moved && isIndirect(unit)) return [];
  if (isIndirect(unit) && TERRAIN_DATA[tileAt(state, x, y).terrain].canopy) return [];
  const teamSight = state.fog ? visibleTiles(state, unit.owner) : null;
  const ownSight = state.fog ? unitVision(state, unit, x, y) : Infinity;
  return state.units.filter((target) => {
    if (target.owner === unit.owner) return false;
    if (DAMAGE[unit.type][target.type] === 0) return false; // no weapon for it
    if (modsOf(target.type).submerged && !mods.antiSub) return false;
    const d = manhattan(x, y, target.x, target.y);
    if (d < data.minRange || d > data.maxRange) return false;
    // Team sight (with forest and cloak rules), or the attacker's own eyes
    // from its firing position. Point-blank contact reveals anything.
    if (canSeeUnit(state, unit.owner, target, teamSight ?? undefined)) return true;
    if (d <= 1) return true;
    if (!teamSight || isCloaked(target)) return false;
    const hidesInForest = tileAt(state, target.x, target.y).terrain === 'forest' && !isAir(target);
    return !hidesInForest && d <= ownSight;
  });
}

/** Whether the defender fires back after surviving an attack. */
export function canCounter(attacker: Unit, defender: Unit): boolean {
  if (defender.hp <= 0) return false;
  if (modsOf(attacker.type).stun || modsOf(defender.type).noCounter) return false;
  if (DAMAGE[defender.type][attacker.type] === 0) return false; // no weapon
  const d = manhattan(attacker.x, attacker.y, defender.x, defender.y);
  if (isIndirect(attacker) || isIndirect(defender)) {
    // Counter-battery: an indirect defender answers indirect fire within its own range.
    const dd = UNIT_DATA[defender.type];
    return (
      isIndirect(attacker) &&
      isIndirect(defender) &&
      modsOf(defender.type).counterBattery === true &&
      d >= dd.minRange &&
      d <= dd.maxRange
    );
  }
  return d === 1;
}

/** A cloaked attacker the enemy hasn't found yet strikes for double damage. */
export const CLOAK_STRIKE = 2;

export function strikesFromCloak(state: GameState, attacker: Unit): boolean {
  return isCloaked(attacker) && !detectedBy(state, attacker.owner === 'red' ? 'blue' : 'red', attacker);
}

export interface AttackForecast {
  /** HP (0-100 scale) the target loses. */
  damage: number;
  /** HP the attacker loses to the counter-attack; 0 when there is none. */
  counter: number;
  kills: boolean;
  /** The counter-attack would destroy the attacker. */
  dies: boolean;
}

/**
 * What happens if `attacker`, after moving to `to`, attacks `target` now.
 * Mirrors applyAttack: the counter comes from the damaged target and hits
 * the attacker on its destination tile.
 */
export function forecastAttack(
  state: GameState,
  attacker: Unit,
  to: { x: number; y: number },
  target: Unit,
): AttackForecast {
  const moved = { ...attacker, x: to.x, y: to.y };
  const bonus = strikesFromCloak(state, attacker) ? CLOAK_STRIKE : 1;
  const damage = Math.min(target.hp, Math.round(computeDamage(state, moved, target) * bonus));
  const after = { ...target, hp: target.hp - damage };
  const counter =
    after.hp > 0 && canCounter(moved, after) ? Math.min(moved.hp, computeDamage(state, after, moved, true)) : 0;
  return { damage, counter, kills: after.hp === 0, dies: counter >= attacker.hp };
}
