export type PlayerId = 'red' | 'blue';

/**
 * Red's win condition on top of the standard HQ capture / rout, for
 * campaign missions. Blue always wins the standard way.
 */
export type Objective =
  | { kind: 'survive'; day: number }
  | { kind: 'capture'; count: number };

export type Terrain =
  | 'plain'
  | 'road'
  | 'forest'
  | 'mountain'
  | 'water'
  | 'city'
  | 'factory'
  | 'hq'
  | 'shore'
  | 'shallow'
  | 'bridge'
  | 'volcano'
  | 'refinery'
  | 'airbase'
  | 'port'
  | 'rig';

export type UnitType =
  | 'infantry'
  | 'bazooka'
  | 'recon'
  | 'lightTank'
  | 'heavyTank'
  | 'artillery'
  | 'antiAir'
  | 'helicopter'
  | 'skylift'
  | 'barge'
  | 'cutter'
  | 'frigate'
  | 'destroyer'
  | 'submarine'
  | 'cruiser'
  | 'stealthTank'
  | 'rocketTruck'
  | 'fighter'
  | 'bomber'
  | 'turret';

export type MoveClass = 'foot' | 'tires' | 'treads' | 'air' | 'sea';

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
  /** Scavenge already granted its extra action this turn. */
  scavenged?: boolean;
  /** Units riding inside a transport. They are off the board until unloaded. */
  cargo?: Unit[];
}

export interface Tile {
  terrain: Terrain;
  /** Owner of a property tile (city/factory/hq). Null = neutral. */
  owner: PlayerId | null;
  /** Remaining capture points (counts down from CAPTURE_POINTS). */
  capturePoints: number;
  /** Unit currently capturing this tile; progress resets if it leaves or dies. */
  capturingUnitId: number | null;
  /** Upgrade tier of an upgradable property (refineries); absent = 1. */
  level?: number;
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
  objective?: Objective;
  /** Unit types factories may build in this game; undefined = all of them. */
  roster?: UnitType[];
}

export type UnitAction =
  | { type: 'wait' }
  | { type: 'attack'; targetId: number }
  | { type: 'capture' }
  /** Board the friendly transport standing on the destination tile. */
  | { type: 'load' }
  /** Drop cargo onto tiles next to the transport's destination. */
  | { type: 'unload'; drops: { unitId: number; at: { x: number; y: number } }[] };

export type Command =
  | { kind: 'move'; unitId: number; to: { x: number; y: number }; action: UnitAction }
  | { kind: 'build'; at: { x: number; y: number }; unitType: UnitType }
  /** Pay to raise an owned property's tier (a refinery's output). */
  | { kind: 'upgrade'; at: { x: number; y: number } }
  | { kind: 'endTurn' };

/** Things that happened while applying a command, for UI feedback. */
export type GameEvent =
  | { type: 'moved'; unitId: number; from: { x: number; y: number }; to: { x: number; y: number } }
  | { type: 'ambushed'; unitId: number; at: { x: number; y: number } }
  | { type: 'damage'; targetId: number; at: { x: number; y: number }; amount: number; destroyed: boolean }
  | { type: 'captureProgress'; at: { x: number; y: number }; remaining: number }
  | { type: 'captured'; at: { x: number; y: number }; by: PlayerId }
  | { type: 'built'; unitId: number; at: { x: number; y: number } }
  | { type: 'upgraded'; at: { x: number; y: number }; level: number }
  | { type: 'turnStarted'; player: PlayerId; day: number; income: number }
  | { type: 'loaded'; unitId: number; transportId: number }
  | { type: 'unloaded'; unitId: number; transportId: number; at: { x: number; y: number } }
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
