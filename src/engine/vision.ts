import { MOUNTAIN_VISION_BONUS, PROPERTY_VISION, TERRAIN_DATA, UNIT_DATA } from './data';
import { tileAt } from './state';
import type { GameState, PlayerId, Unit } from './types';

export function isAir(unit: Unit): boolean {
  return UNIT_DATA[unit.type].moveClass === 'air';
}

/** Sight radius of a unit standing at (x, y). */
export function unitVision(state: GameState, unit: Unit, x: number, y: number): number {
  let vision = UNIT_DATA[unit.type].vision;
  if (UNIT_DATA[unit.type].moveClass === 'foot' && tileAt(state, x, y).terrain === 'mountain') {
    vision += MOUNTAIN_VISION_BONUS;
  }
  return vision;
}

/**
 * Tile indices (y * width + x) the player can currently see: manhattan
 * discs around their units and owned properties. Only meaningful when
 * state.fog is true — without fog everything is visible.
 */
export function visibleTiles(state: GameState, player: PlayerId): Set<number> {
  const visible = new Set<number>();
  const reveal = (cx: number, cy: number, radius: number) => {
    for (let dy = -radius; dy <= radius; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= state.height) continue;
      const span = radius - Math.abs(dy);
      for (let x = Math.max(0, cx - span); x <= Math.min(state.width - 1, cx + span); x++) {
        visible.add(y * state.width + x);
      }
    }
  };

  for (const unit of state.units) {
    if (unit.owner === player) reveal(unit.x, unit.y, unitVision(state, unit, unit.x, unit.y));
  }
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = tileAt(state, x, y);
      if (TERRAIN_DATA[tile.terrain].capturable && tile.owner === player) {
        reveal(x, y, PROPERTY_VISION);
      }
    }
  }
  return visible;
}

export function isVisible(state: GameState, player: PlayerId, x: number, y: number): boolean {
  if (!state.fog) return true;
  return visibleTiles(state, player).has(y * state.width + x);
}

/**
 * Whether the player can see this specific unit. On top of tile visibility,
 * ground units hiding in forests stay unseen until one of the player's
 * units moves adjacent to them. Aircraft can't hide in trees.
 */
export function canSeeUnit(
  state: GameState,
  player: PlayerId,
  target: Unit,
  sight?: Set<number>,
): boolean {
  if (!state.fog || target.owner === player) return true;
  const tiles = sight ?? visibleTiles(state, player);
  if (!tiles.has(target.y * state.width + target.x)) return false;
  if (tileAt(state, target.x, target.y).terrain !== 'forest' || isAir(target)) return true;
  return state.units.some(
    (u) =>
      u.owner === player &&
      Math.abs(u.x - target.x) + Math.abs(u.y - target.y) <= 1,
  );
}
