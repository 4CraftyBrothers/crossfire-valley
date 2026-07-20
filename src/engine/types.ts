export type PlayerId = 'red' | 'blue';

export type Terrain =
  | 'plain'
  | 'road'
  | 'forest'
  | 'mountain'
  | 'water'
  | 'city'
  | 'factory'
  | 'hq';

export type UnitType =
  | 'infantry'
  | 'bazooka'
  | 'recon'
  | 'lightTank'
  | 'heavyTank'
  | 'artillery'
  | 'antiAir'
  | 'helicopter';

export type MoveClass = 'foot' | 'tires' | 'treads' | 'air';

export interface Unit {
  id: number;
  type: UnitType;
  owner: PlayerId;
  x: number;
  y: number;
  /** Internal hit points, 0-100. Displayed as ceil(hp / 10). */
  hp: number;
  /** True once the unit has taken its action this turn. */
  acted: boolean;
}

export interface Tile {
  terrain: Terrain;
  /** Owner of a property tile (city/factory/hq). Null = neutral. */
  owner: PlayerId | null;
  /** Remaining capture points (counts down from CAPTURE_POINTS). */
  capturePoints: number;
  /** Unit currently capturing this tile; progress resets if it leaves or dies. */
  capturingUnitId: number | null;
}

export interface GameState {
  width: number;
  height: number;
  /** Row-major, index = y * width + x. */
  tiles: Tile[];
  units: Unit[];
  nextUnitId: number;
  current: PlayerId;
  day: number;
  funds: Record<PlayerId, number>;
  winner: PlayerId | null;
  /** Fog of war: units are hidden outside vision and can't be attacked unseen. */
  fog: boolean;
}

export type UnitAction =
  | { type: 'wait' }
  | { type: 'attack'; targetId: number }
  | { type: 'capture' };

export type Command =
  | { kind: 'move'; unitId: number; to: { x: number; y: number }; action: UnitAction }
  | { kind: 'build'; at: { x: number; y: number }; unitType: UnitType }
  | { kind: 'endTurn' };

/** Things that happened while applying a command, for UI feedback. */
export type GameEvent =
  | { type: 'moved'; unitId: number; from: { x: number; y: number }; to: { x: number; y: number } }
  | { type: 'ambushed'; unitId: number; at: { x: number; y: number } }
  | { type: 'damage'; targetId: number; at: { x: number; y: number }; amount: number; destroyed: boolean }
  | { type: 'captureProgress'; at: { x: number; y: number }; remaining: number }
  | { type: 'captured'; at: { x: number; y: number }; by: PlayerId }
  | { type: 'built'; unitId: number; at: { x: number; y: number } }
  | { type: 'turnStarted'; player: PlayerId; day: number; income: number }
  | { type: 'victory'; winner: PlayerId };

export interface CommandResult {
  state: GameState;
  events: GameEvent[];
}

export interface MapUnitDef {
  type: UnitType;
  owner: PlayerId;
  x: number;
  y: number;
}

export interface MapDef {
  name: string;
  /** Terrain grid, one string per row. See CHAR_TERRAIN in state.ts. */
  grid: string[];
  /** Ownership of property tiles at game start. */
  properties: { x: number; y: number; owner: PlayerId }[];
  units: MapUnitDef[];
  /** Shared starting funds, or per-player for asymmetric scenarios. */
  startingFunds: number | Record<PlayerId, number>;
}
