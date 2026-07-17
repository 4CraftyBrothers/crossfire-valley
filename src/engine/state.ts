import { CAPTURE_POINTS, INCOME_PER_PROPERTY, TERRAIN_DATA, MAX_HP } from './data';
import type { GameState, MapDef, PlayerId, Terrain, Tile, Unit } from './types';

export const CHAR_TERRAIN: Record<string, Terrain> = {
  '.': 'plain',
  'r': 'road',
  'f': 'forest',
  'm': 'mountain',
  'w': 'water',
  'c': 'city',
  'F': 'factory',
  'H': 'hq',
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

export function createGame(map: MapDef): GameState {
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
    funds: { red: map.startingFunds, blue: map.startingFunds },
    winner: null,
  };

  for (const p of map.properties) {
    const tile = tileAt(state, p.x, p.y);
    if (!TERRAIN_DATA[tile.terrain].capturable) {
      throw new Error(`Property at ${p.x},${p.y} is not capturable terrain`);
    }
    tile.owner = p.owner;
  }

  // Each player collects income at the start of their turn; blue's first
  // turn begins via endTurn, so red's day-1 income is applied here.
  state.funds.red += INCOME_PER_PROPERTY * propertiesOwned(state, 'red');

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

  return state;
}
