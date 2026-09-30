import { CAPTURE_POINTS, CONTROL_DISCOUNT, INCOME_PER_PROPERTY, MAX_CONTROL_DISCOUNT, MAX_HP, TERRAIN_DATA, UNIT_DATA } from './data';
import type { GameState, MapDef, Objective, PlayerId, Terrain, Tile, Unit, UnitType } from './types';

export const CHAR_TERRAIN: Record<string, Terrain> = {
  '.': 'plain',
  'r': 'road',
  'f': 'forest',
  'm': 'mountain',
  'w': 'water',
  'c': 'city',
  'F': 'factory',
  'H': 'hq',
  's': 'shore',
  'x': 'shallow',
  'b': 'bridge',
  'v': 'volcano',
  'R': 'refinery',
  'A': 'airbase',
  'P': 'port',
  'O': 'rig',
  'o': 'ore',
};

export function tileAt(state: GameState, x: number, y: number): Tile {
  return state.tiles[y * state.width + x];
}

export function inBounds(state: GameState, x: number, y: number): boolean {
  return x >= 0 && x < state.width && y >= 0 && y < state.height;
}

export function unitAt(state: GameState, x: number, y: number): Unit | undefined {
  return state.units.find((u) => u.x === x && u.y === y);
}

export function unitById(state: GameState, id: number): Unit | undefined {
  return state.units.find((u) => u.id === id);
}

export function enemyOf(player: PlayerId): PlayerId {
  return player === 'red' ? 'blue' : 'red';
}

/** Displayed hit points, 1-10. */
export function visualHp(unit: Unit): number {
  return Math.ceil(unit.hp / 10);
}

export function propertiesOwned(state: GameState, player: PlayerId): number {
  return state.tiles.filter((t) => TERRAIN_DATA[t.terrain].capturable && t.owner === player).length;
}

/** What one property pays its owner each turn, allowing for upgrades. */
export function tileIncome(tile: Tile): number {
  const td = TERRAIN_DATA[tile.terrain];
  const level = tile.level ?? 1;
  if (level > 1 && td.upgrades?.[level - 2]) return td.upgrades[level - 2].income;
  return td.income ?? INCOME_PER_PROPERTY;
}

/** Funds a player collects at the start of a turn from everything they own. */
export function incomeFor(state: GameState, player: PlayerId): number {
  let income = 0;
  for (const tile of state.tiles) {
    if (TERRAIN_DATA[tile.terrain].capturable && tile.owner === player) income += tileIncome(tile);
  }
  return income;
}

/**
 * A unit's price for this player. Owning Airbases makes air units cheaper
 * and owning Ports makes ships cheaper (5% each, capped at 20%).
 */
export function unitCost(state: GameState, player: PlayerId, type: UnitType): number {
  const base = UNIT_DATA[type].cost;
  const site = UNIT_DATA[type].domain === 'air' ? 'airbase' : UNIT_DATA[type].domain === 'sea' ? 'port' : null;
  if (!site) return base;
  const owned = state.tiles.filter((t) => t.terrain === site && t.owner === player).length;
  const discount = Math.min(MAX_CONTROL_DISCOUNT, owned * CONTROL_DISCOUNT);
  return Math.round((base * (1 - discount)) / 100) * 100;
}

export interface GameOptions {
  fog?: boolean;
  objective?: Objective;
  /** Limit what factories can build (a campaign Book's roster). */
  roster?: UnitType[];
}

export function createGame(map: MapDef, options: GameOptions = {}): GameState {
  const height = map.grid.length;
  const width = map.grid[0].length;
  const tiles: Tile[] = [];

  for (let y = 0; y < height; y++) {
    if (map.grid[y].length !== width) {
      throw new Error(`Map row ${y} has width ${map.grid[y].length}, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = map.grid[y][x];
      const terrain = CHAR_TERRAIN[ch];
      if (!terrain) throw new Error(`Unknown terrain char '${ch}' at ${x},${y}`);
      tiles.push({ terrain, owner: null, capturePoints: CAPTURE_POINTS, capturingUnitId: null });
    }
  }

  const state: GameState = {
    width,
    height,
    tiles,
    units: [],
    nextUnitId: 1,
    current: 'red',
    day: 1,
    funds:
      typeof map.startingFunds === 'number'
        ? { red: map.startingFunds, blue: map.startingFunds }
        : { ...map.startingFunds },
    winner: null,
    fog: options.fog ?? false,
  };
  if (options.objective) state.objective = { ...options.objective };
  if (options.roster) state.roster = [...options.roster];

  for (const p of map.properties) {
    const tile = tileAt(state, p.x, p.y);
    if (!TERRAIN_DATA[tile.terrain].capturable) {
      throw new Error(`Property at ${p.x},${p.y} is not capturable terrain`);
    }
    tile.owner = p.owner;
  }

  // Each player collects income at the start of their turn; blue's first
  // turn begins via endTurn, so red's day-1 income is applied here.
  state.funds.red += incomeFor(state, 'red');

  for (const def of map.units) {
    state.units.push({
      id: state.nextUnitId++,
      type: def.type,
      owner: def.owner,
      x: def.x,
      y: def.y,
      hp: MAX_HP,
      acted: false,
    });
  }

  // Whoever starts with a linchpin (a Warmachine) loses when every one is gone.
  const linchpin = (['red', 'blue'] as PlayerId[]).filter((p) =>
    state.units.some((u) => u.owner === p && UNIT_DATA[u.type].mods?.linchpin),
  );
  if (linchpin.length > 0) state.linchpin = linchpin;
  return state;
}
