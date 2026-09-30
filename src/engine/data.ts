import type { MoveClass, Terrain, UnitType } from './types';

export type Domain = 'ground' | 'air' | 'sea';

/**
 * Optional unit abilities. Every flag is off by default; each is resolved
 * in exactly one place (combat.ts, movement.ts or game.ts startTurn). See
 * docs/ENGINE_DATA_MODEL.md.
 */
export interface UnitMods {
  /** Extra damage fraction when this unit initiates an attack. */
  blitz?: number;
  /** Damage fraction lost on this unit's counter-attacks. */
  mammoth?: number;
  /** Damage fraction gained on this unit's counter-attacks. */
  courage?: number;
  /** Never counter-attacks. */
  noCounter?: boolean;
  /** Indirect unit that returns fire on indirect attackers within its range. */
  counterBattery?: boolean;
  /** Targets never counter this unit's attacks. */
  stun?: boolean;
  /** May act again after a kill, once per turn. */
  scavenge?: boolean;
  /** Fraction of damage also dealt to the enemy directly behind the target. */
  piercing?: number;
  /** Only antiSub attackers can target it. */
  submerged?: boolean;
  /** May target submerged units. */
  antiSub?: boolean;
  /** Cannot enter shallow water. */
  massiveHull?: boolean;
  /** HP regained at the start of its owner's turn, anywhere. */
  heal?: number;
  /** Never offered in a factory. */
  unbuildable?: boolean;
  /** Invisible to the enemy unless one of their units is adjacent or jamming covers it. */
  cloak?: boolean;
  /** Bumping into a hidden enemy triggers an attack on it. */
  tracking?: boolean;
  /** Reveals cloaked enemies within this many tiles. */
  jamming?: number;
  /** Builds units on adjacent tiles (spending its own action). */
  builder?: boolean;
  /** Earns this much a turn while standing on an ore deposit. */
  extractor?: number;
  /** Losing every linchpin unit loses the game. */
  linchpin?: boolean;
  /** Carries up to `capacity` friendly units of the listed move classes. */
  transport?: { capacity: number; carries: MoveClass[] };
}

export interface UnitData {
  name: string;
  cost: number;
  move: number;
  moveClass: MoveClass;
  domain: Domain;
  /** Inclusive attack range. Direct units are 1-1; indirect can't move and fire. */
  minRange: number;
  maxRange: number;
  canCapture: boolean;
  /** Fog of war sight radius (manhattan). */
  vision: number;
  /** Buildings that can produce it; default is the factory. */
  builtAt?: Terrain[];
  mods?: UnitMods;
}

export const UNIT_DATA: Record<UnitType, UnitData> = {
  infantry:   { name: 'Infantry',   cost: 1000,  move: 3, moveClass: 'foot',   domain: 'ground', minRange: 1, maxRange: 1, canCapture: true,  vision: 2,
                mods: { tracking: true } },
  bazooka:    { name: 'Bazooka',    cost: 2500,  move: 2, moveClass: 'foot',   domain: 'ground', minRange: 1, maxRange: 1, canCapture: true,  vision: 2,
                mods: { tracking: true } },
  recon:      { name: 'Recon',      cost: 4000,  move: 8, moveClass: 'tires',  domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 5 },
  lightTank:  { name: 'Light Tank', cost: 7000,  move: 6, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 3 },
  heavyTank:  { name: 'Heavy Tank', cost: 16000, move: 5, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 2 },
  artillery:  { name: 'Artillery',  cost: 6000,  move: 4, moveClass: 'treads', domain: 'ground', minRange: 2, maxRange: 3, canCapture: false, vision: 2 },
  antiAir:    { name: 'Anti-Air',   cost: 8000,  move: 6, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 2 },
  helicopter: { name: 'Helicopter', cost: 9000,  move: 6, moveClass: 'air',    domain: 'air',    minRange: 1, maxRange: 1, canCapture: false, vision: 4 },
  // Book II transports. No weapons: their DAMAGE rows are all zero.
  skylift:    { name: 'Skylift',    cost: 4000,  move: 6, moveClass: 'air',    domain: 'air',    minRange: 1, maxRange: 1, canCapture: false, vision: 2,
                builtAt: ['airbase'], mods: { transport: { capacity: 1, carries: ['foot'] } } },
  barge:      { name: 'Barge',      cost: 7000,  move: 5, moveClass: 'sea',    domain: 'sea',    minRange: 1, maxRange: 1, canCapture: false, vision: 2,
                builtAt: ['port'], mods: { transport: { capacity: 2, carries: ['foot', 'tires', 'treads'] } } },
  // Book II warships, all built at a Port.
  cutter:     { name: 'Cutter',     cost: 5000,  move: 6, moveClass: 'sea',    domain: 'sea',    minRange: 1, maxRange: 1, canCapture: true,  vision: 3,
                builtAt: ['port'] },
  frigate:    { name: 'Frigate',    cost: 9000,  move: 6, moveClass: 'sea',    domain: 'sea',    minRange: 1, maxRange: 1, canCapture: false, vision: 4,
                builtAt: ['port'], mods: { antiSub: true } },
  destroyer:  { name: 'Destroyer',  cost: 14000, move: 5, moveClass: 'sea',    domain: 'sea',    minRange: 1, maxRange: 1, canCapture: false, vision: 3,
                builtAt: ['port'], mods: { massiveHull: true } },
  submarine:  { name: 'Submarine',  cost: 16000, move: 5, moveClass: 'sea',    domain: 'sea',    minRange: 1, maxRange: 1, canCapture: false, vision: 3,
                builtAt: ['port'], mods: { submerged: true, cloak: true } },
  cruiser:    { name: 'Cruiser',    cost: 20000, move: 4, moveClass: 'sea',    domain: 'sea',    minRange: 3, maxRange: 5, canCapture: false, vision: 3,
                builtAt: ['port'], mods: { massiveHull: true } },
  // Book II: a cloaked tank. Hits twice as hard from hiding.
  stealthTank: { name: 'Stealth Tank', cost: 12000, move: 5, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 3,
                mods: { cloak: true } },
  // Book II: long-range rockets that also reach aircraft and submarines.
  rocketTruck: { name: 'Rocket Truck', cost: 15000, move: 5, moveClass: 'tires', domain: 'ground', minRange: 3, maxRange: 5, canCapture: false, vision: 2,
                mods: { antiSub: true } },
  // Book II jets, built at an Airbase.
  fighter:    { name: 'Fighter',    cost: 18000, move: 8, moveClass: 'air',    domain: 'air',    minRange: 1, maxRange: 1, canCapture: false, vision: 4,
                builtAt: ['airbase'] },
  bomber:     { name: 'Bomber',     cost: 22000, move: 6, moveClass: 'air',    domain: 'air',    minRange: 1, maxRange: 1, canCapture: false, vision: 3,
                builtAt: ['airbase'], mods: { noCounter: true } },
  // A fixed gun emplacement placed by the map; it never moves and patches itself up.
  turret:     { name: 'Turret',     cost: 0,     move: 0, moveClass: 'treads', domain: 'ground', minRange: 2, maxRange: 5, canCapture: false, vision: 4,
                builtAt: [], mods: { heal: 10, unbuildable: true } },
  // Book III: a mobile base. Builds beside itself, mines ore, and if every
  // Warmachine a side started with is lost, that side loses.
  warmachine: { name: 'Warmachine', cost: 0,     move: 3, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 3,
                builtAt: [], mods: { builder: true, extractor: 1500, linchpin: true, heal: 5, unbuildable: true } },
  // Book III specialists.
  spider:     { name: 'Spider',     cost: 9000,  move: 4, moveClass: 'foot',   domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 3,
                mods: { stun: true } },
  lancer:     { name: 'Lancer',     cost: 11000, move: 5, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 2,
                mods: { piercing: 0.5 } },
  vulture:    { name: 'Vulture',    cost: 8000,  move: 7, moveClass: 'air',    domain: 'air',    minRange: 1, maxRange: 1, canCapture: false, vision: 4,
                mods: { scavenge: true } },
  jammer:     { name: 'Jammer',     cost: 6000,  move: 6, moveClass: 'tires',  domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 4,
                mods: { jamming: 3 } },
  blockade:   { name: 'Blockade',   cost: 0,     move: 0, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 1,
                builtAt: [], mods: { noCounter: true, unbuildable: true } },
};

/** Book III specialists; Books before it don't build them. */
export const BOOK_THREE_UNITS: UnitType[] = ['spider', 'lancer', 'vulture', 'jammer'];

/** The units Book I introduces; its missions build only these. */
export const BOOK_ONE_ROSTER: UnitType[] = [
  'infantry', 'bazooka', 'recon', 'lightTank', 'heavyTank', 'artillery', 'antiAir', 'helicopter',
];

/** Where a unit type can be built. */
export function builtAt(type: UnitType): Terrain[] {
  return UNIT_DATA[type].builtAt ?? ['factory'];
}

/** Buildings that produce units. */
export const BUILD_SITES: Terrain[] = ['factory', 'airbase', 'port'];

/** Convenience: a unit type's modifiers, never undefined. */
export function modsOf(type: UnitType): UnitMods {
  return UNIT_DATA[type].mods ?? {};
}

export const BUILDABLE_UNITS: UnitType[] = [
  'infantry',
  'bazooka',
  'recon',
  'artillery',
  'lightTank',
  'antiAir',
  'helicopter',
  'heavyTank',
  'skylift',
  'barge',
  'cutter',
  'frigate',
  'destroyer',
  'submarine',
  'cruiser',
  'stealthTank',
  'rocketTruck',
  'fighter',
  'bomber',
  'spider',
  'lancer',
  'vulture',
  'jammer',
];

export interface TerrainData {
  name: string;
  defenseStars: number;
  /** Land, sea, or the shore where the two meet (a barge's loading point). */
  domain: 'land' | 'sea' | 'shore';
  /** Movement cost per move class; null = impassable. */
  moveCost: Record<MoveClass, number | null>;
  capturable: boolean;
  /** Per-turn income for a capturable tile; default INCOME_PER_PROPERTY. */
  income?: number;
  /** Massive-hull ships cannot enter. */
  shallow?: boolean;
  /** HP lost by non-air units that start a turn here. */
  hazard?: number;
  /** Damage from indirect fire reduced by a quarter. */
  highGround?: boolean;
  /** Indirect units cannot fire from here. */
  canopy?: boolean;
  /** What a construction tile can build. */
  builds?: Domain[];
  /** Paid upgrades, in order: each raises the tile's income. */
  upgrades?: { cost: number; income: number }[];
}

const LAND = { foot: 1, tires: 1, treads: 1, air: 1, sea: null } as const;

export const TERRAIN_DATA: Record<Terrain, TerrainData> = {
  plain:    { name: 'Plains',    defenseStars: 1, domain: 'land',  moveCost: { foot: 1, tires: 2, treads: 1, air: 1, sea: null },       capturable: false },
  road:     { name: 'Road',      defenseStars: 0, domain: 'land',  moveCost: { ...LAND },                                                  capturable: false },
  forest:   { name: 'Forest',    defenseStars: 2, domain: 'land',  moveCost: { foot: 1, tires: 3, treads: 2, air: 1, sea: null },       capturable: false },
  mountain: { name: 'Mountain',  defenseStars: 4, domain: 'land',  moveCost: { foot: 2, tires: null, treads: null, air: 1, sea: null }, capturable: false },
  water:    { name: 'Water',     defenseStars: 0, domain: 'sea',   moveCost: { foot: null, tires: null, treads: null, air: 1, sea: 1 }, capturable: false },
  city:     { name: 'City',      defenseStars: 3, domain: 'land',  moveCost: { ...LAND },                                                  capturable: true },
  factory:  { name: 'Factory',   defenseStars: 3, domain: 'land',  moveCost: { ...LAND },                                                  capturable: true, builds: ['ground'] },
  hq:       { name: 'HQ',        defenseStars: 4, domain: 'land',  moveCost: { ...LAND },                                                  capturable: true },
  // Shore is where land and sea meet: ground units walk it and ships can beach on it.
  shore:    { name: 'Shore',     defenseStars: 0, domain: 'shore', moveCost: { ...LAND, sea: 1 },                                         capturable: false },
  shallow:  { name: 'Shallows',  defenseStars: 0, domain: 'sea',   moveCost: { foot: null, tires: null, treads: null, air: 1, sea: 1 }, capturable: false, shallow: true },
  bridge:   { name: 'Bridge',    defenseStars: 0, domain: 'land',  moveCost: { ...LAND },                                                  capturable: false },
  volcano:  { name: 'Volcano',   defenseStars: 0, domain: 'land',  moveCost: { foot: null, tires: null, treads: null, air: null, sea: null }, capturable: false },
  refinery: { name: 'Refinery',  defenseStars: 2, domain: 'land',  moveCost: { ...LAND },                                                  capturable: true, income: 2000,
              upgrades: [{ cost: 6000, income: 3500 }, { cost: 9000, income: 5000 }] },
  airbase:  { name: 'Airbase',   defenseStars: 3, domain: 'land',  moveCost: { ...LAND },                                                  capturable: true, builds: ['air'] },
  // A port sits on the waterline, so ships launch from it and dock at it.
  port:     { name: 'Port',      defenseStars: 3, domain: 'shore', moveCost: { ...LAND, sea: 1 },                                         capturable: true, builds: ['sea'] },
  // Book III terrain.
  ash:      { name: 'Ash field', defenseStars: 0, domain: 'land',  moveCost: { ...LAND },                                                  capturable: false, hazard: 10 },
  ridge:    { name: 'Ridge',     defenseStars: 2, domain: 'land',  moveCost: { foot: 1, tires: 2, treads: 2, air: 1, sea: null },     capturable: false, highGround: true },
  canyon:   { name: 'Canyon',    defenseStars: 1, domain: 'land',  moveCost: { ...LAND },                                                  capturable: false, canopy: true },
  // An ore deposit: a Warmachine parked on it mines it for income.
  ore:      { name: 'Ore deposit', defenseStars: 1, domain: 'land', moveCost: { foot: 1, tires: 2, treads: 1, air: 1, sea: null }, capturable: false },
  // An oil rig out at sea: only ships can reach it, and only a Cutter can capture it.
  rig:      { name: 'Oil rig',   defenseStars: 1, domain: 'sea',   moveCost: { foot: null, tires: null, treads: null, air: 1, sea: 1 }, capturable: true, income: 1500 },
};

/**
 * Base damage percent dealt by a full-health attacker to a full-health
 * defender on 0-star terrain. Rows: attacker. Columns: defender.
 * A value of 0 means the attacker has no weapon against that target
 * (e.g. artillery cannot shell aircraft) — such attacks are illegal.
 */
export const DAMAGE: Record<UnitType, Record<UnitType, number>> = {
  //            vs: see the column keys; rows are attackers
  infantry:   { infantry: 55, bazooka: 45, recon: 12, lightTank: 5,  heavyTank: 1,   artillery: 15,  antiAir: 5,   helicopter: 7, skylift: 20, barge: 5, cutter: 5, frigate: 1, destroyer: 1, submarine: 0, cruiser: 1, stealthTank: 4, rocketTruck: 15, fighter: 0, bomber: 0, turret: 5, warmachine: 1, spider: 12, lancer: 5, vulture: 10, jammer: 15, blockade: 3 },
  bazooka:    { infantry: 65, bazooka: 55, recon: 85, lightTank: 55, heavyTank: 15,  artillery: 70,  antiAir: 60,  helicopter: 9, skylift: 10, barge: 30, cutter: 25, frigate: 10, destroyer: 5, submarine: 0, cruiser: 5, stealthTank: 50, rocketTruck: 75, fighter: 0, bomber: 0, turret: 50, warmachine: 20, spider: 65, lancer: 55, vulture: 5, jammer: 75, blockade: 20 },
  recon:      { infantry: 70, bazooka: 65, recon: 35, lightTank: 6,  heavyTank: 1,   artillery: 45,  antiAir: 4,   helicopter: 10, skylift: 20, barge: 5, cutter: 10, frigate: 2, destroyer: 1, submarine: 0, cruiser: 1, stealthTank: 5, rocketTruck: 45, fighter: 0, bomber: 0, turret: 5, warmachine: 1, spider: 35, lancer: 6, vulture: 15, jammer: 60, blockade: 3 },
  lightTank:  { infantry: 75, bazooka: 70, recon: 85, lightTank: 55, heavyTank: 15,  artillery: 70,  antiAir: 65,  helicopter: 6, skylift: 10, barge: 20, cutter: 25, frigate: 10, destroyer: 5, submarine: 0, cruiser: 5, stealthTank: 50, rocketTruck: 70, fighter: 0, bomber: 0, turret: 45, warmachine: 12, spider: 70, lancer: 55, vulture: 5, jammer: 80, blockade: 15 },
  heavyTank:  { infantry: 105, bazooka: 95, recon: 105, lightTank: 85, heavyTank: 55, artillery: 105, antiAir: 105, helicopter: 12, skylift: 15, barge: 40, cutter: 45, frigate: 25, destroyer: 15, submarine: 0, cruiser: 15, stealthTank: 80, rocketTruck: 90, fighter: 0, bomber: 0, turret: 70, warmachine: 30, spider: 95, lancer: 85, vulture: 10, jammer: 105, blockade: 30 },
  artillery:  { infantry: 90, bazooka: 85, recon: 80, lightTank: 70, heavyTank: 45,  artillery: 75,  antiAir: 75,  helicopter: 0, skylift: 0, barge: 60, cutter: 70, frigate: 55, destroyer: 45, submarine: 0, cruiser: 45, stealthTank: 65, rocketTruck: 75, fighter: 0, bomber: 0, turret: 60, warmachine: 30, spider: 75, lancer: 70, vulture: 0, jammer: 80, blockade: 40 },
  antiAir:    { infantry: 105, bazooka: 105, recon: 60, lightTank: 25, heavyTank: 10, artillery: 50,  antiAir: 45,  helicopter: 120, skylift: 120, barge: 10, cutter: 10, frigate: 5, destroyer: 2, submarine: 0, cruiser: 2, stealthTank: 20, rocketTruck: 55, fighter: 70, bomber: 90, turret: 20, warmachine: 5, spider: 60, lancer: 25, vulture: 120, jammer: 60, blockade: 5 },
  helicopter: { infantry: 75, bazooka: 75, recon: 55, lightTank: 55, heavyTank: 25,  artillery: 65,  antiAir: 25,  helicopter: 65, skylift: 85, barge: 35, cutter: 50, frigate: 25, destroyer: 20, submarine: 0, cruiser: 20, stealthTank: 50, rocketTruck: 70, fighter: 0, bomber: 0, turret: 45, warmachine: 15, spider: 60, lancer: 55, vulture: 70, jammer: 65, blockade: 15 },
  skylift:    { infantry: 0, bazooka: 0, recon: 0, lightTank: 0, heavyTank: 0, artillery: 0, antiAir: 0, helicopter: 0, skylift: 0, barge: 0, cutter: 0, frigate: 0, destroyer: 0, submarine: 0, cruiser: 0, stealthTank: 0, rocketTruck: 0, fighter: 0, bomber: 0, turret: 0, warmachine: 0, spider: 0, lancer: 0, vulture: 0, jammer: 0, blockade: 0 },
  barge:      { infantry: 0, bazooka: 0, recon: 0, lightTank: 0, heavyTank: 0, artillery: 0, antiAir: 0, helicopter: 0, skylift: 0, barge: 0, cutter: 0, frigate: 0, destroyer: 0, submarine: 0, cruiser: 0, stealthTank: 0, rocketTruck: 0, fighter: 0, bomber: 0, turret: 0, warmachine: 0, spider: 0, lancer: 0, vulture: 0, jammer: 0, blockade: 0 },
  cutter:     { infantry: 45, bazooka: 40, recon: 30, lightTank: 10, heavyTank: 5, artillery: 30, antiAir: 15, helicopter: 20, skylift: 30, barge: 45, cutter: 40, frigate: 15, destroyer: 5, submarine: 0, cruiser: 5, stealthTank: 8, rocketTruck: 20, fighter: 0, bomber: 0, turret: 10, warmachine: 3, spider: 25, lancer: 10, vulture: 20, jammer: 25, blockade: 5 },
  frigate:    { infantry: 50, bazooka: 45, recon: 40, lightTank: 25, heavyTank: 10, artillery: 35, antiAir: 30, helicopter: 90, skylift: 110, barge: 60, cutter: 70, frigate: 45, destroyer: 25, submarine: 80, cruiser: 25, stealthTank: 20, rocketTruck: 35, fighter: 55, bomber: 70, turret: 20, warmachine: 8, spider: 35, lancer: 20, vulture: 90, jammer: 35, blockade: 10 },
  destroyer:  { infantry: 75, bazooka: 70, recon: 70, lightTank: 60, heavyTank: 35, artillery: 65, antiAir: 60, helicopter: 20, skylift: 30, barge: 90, cutter: 90, frigate: 70, destroyer: 55, submarine: 0, cruiser: 60, stealthTank: 55, rocketTruck: 60, fighter: 0, bomber: 0, turret: 50, warmachine: 20, spider: 60, lancer: 50, vulture: 15, jammer: 60, blockade: 30 },
  submarine:  { infantry: 0, bazooka: 0, recon: 0, lightTank: 0, heavyTank: 0, artillery: 0, antiAir: 0, helicopter: 0, skylift: 0, barge: 95, cutter: 95, frigate: 60, destroyer: 85, submarine: 0, cruiser: 90, stealthTank: 0, rocketTruck: 0, fighter: 0, bomber: 0, turret: 0, warmachine: 0, spider: 0, lancer: 0, vulture: 0, jammer: 0, blockade: 0 },
  cruiser:    { infantry: 90, bazooka: 85, recon: 80, lightTank: 70, heavyTank: 55, artillery: 75, antiAir: 70, helicopter: 0, skylift: 0, barge: 90, cutter: 90, frigate: 75, destroyer: 65, submarine: 0, cruiser: 60, stealthTank: 65, rocketTruck: 75, fighter: 0, bomber: 0, turret: 60, warmachine: 30, spider: 75, lancer: 65, vulture: 0, jammer: 75, blockade: 40 },
  // Modest guns: its punch comes from striking out of hiding (CLOAK_STRIKE).
  stealthTank: { infantry: 45, bazooka: 40, recon: 55, lightTank: 35, heavyTank: 8, artillery: 45, antiAir: 40, helicopter: 5, skylift: 0, barge: 15, cutter: 20, frigate: 10, destroyer: 5, submarine: 0, cruiser: 5, stealthTank: 35, rocketTruck: 45, fighter: 0, bomber: 0, turret: 30, warmachine: 10, spider: 45, lancer: 35, vulture: 0, jammer: 50, blockade: 10 },
  rocketTruck: { infantry: 95, bazooka: 90, recon: 90, lightTank: 80, heavyTank: 55, artillery: 80, antiAir: 85, helicopter: 60, skylift: 70, barge: 85, cutter: 85, frigate: 70, destroyer: 60, submarine: 60, cruiser: 55, stealthTank: 80, rocketTruck: 70, fighter: 45, bomber: 55, turret: 50, warmachine: 30, spider: 80, lancer: 70, vulture: 55, jammer: 85, blockade: 35 },
  fighter:     { infantry: 0, bazooka: 0, recon: 0, lightTank: 0, heavyTank: 0, artillery: 0, antiAir: 0, helicopter: 100, skylift: 120, barge: 0, cutter: 0, frigate: 0, destroyer: 0, submarine: 0, cruiser: 0, stealthTank: 0, rocketTruck: 0, fighter: 55, bomber: 100, turret: 0, warmachine: 0, spider: 0, lancer: 0, vulture: 110, jammer: 0, blockade: 0 },
  bomber:      { infantry: 110, bazooka: 110, recon: 105, lightTank: 105, heavyTank: 95, artillery: 105, antiAir: 95, helicopter: 0, skylift: 0, barge: 95, cutter: 95, frigate: 75, destroyer: 85, submarine: 0, cruiser: 85, stealthTank: 100, rocketTruck: 105, fighter: 0, bomber: 0, turret: 95, warmachine: 40, spider: 100, lancer: 105, vulture: 0, jammer: 110, blockade: 50 },
  turret:      { infantry: 70, bazooka: 65, recon: 60, lightTank: 55, heavyTank: 40, artillery: 60, antiAir: 55, helicopter: 55, skylift: 60, barge: 60, cutter: 60, frigate: 45, destroyer: 40, submarine: 0, cruiser: 40, stealthTank: 55, rocketTruck: 60, fighter: 40, bomber: 50, turret: 40, warmachine: 20, spider: 60, lancer: 55, vulture: 45, jammer: 65, blockade: 30 },
  warmachine:  { infantry: 65, bazooka: 60, recon: 60, lightTank: 45, heavyTank: 25, artillery: 55, antiAir: 50, helicopter: 10, skylift: 0, barge: 25, cutter: 25, frigate: 10, destroyer: 8, submarine: 0, cruiser: 8, stealthTank: 45, rocketTruck: 50, fighter: 0, bomber: 0, turret: 30, warmachine: 20, spider: 55, lancer: 45, vulture: 5, jammer: 60, blockade: 25 },
  spider:      { infantry: 70, bazooka: 60, recon: 55, lightTank: 45, heavyTank: 15, artillery: 60, antiAir: 50, helicopter: 0, skylift: 0, barge: 15, cutter: 15, frigate: 5, destroyer: 5, submarine: 0, cruiser: 5, stealthTank: 40, rocketTruck: 55, fighter: 0, bomber: 0, turret: 30, warmachine: 20, spider: 50, lancer: 40, vulture: 0, jammer: 60, blockade: 10 },
  lancer:      { infantry: 75, bazooka: 70, recon: 85, lightTank: 60, heavyTank: 20, artillery: 70, antiAir: 65, helicopter: 6, skylift: 10, barge: 25, cutter: 25, frigate: 10, destroyer: 8, submarine: 0, cruiser: 8, stealthTank: 55, rocketTruck: 70, fighter: 0, bomber: 0, turret: 35, warmachine: 25, spider: 65, lancer: 55, vulture: 5, jammer: 80, blockade: 20 },
  vulture:     { infantry: 65, bazooka: 60, recon: 50, lightTank: 30, heavyTank: 10, artillery: 55, antiAir: 20, helicopter: 40, skylift: 60, barge: 30, cutter: 30, frigate: 5, destroyer: 5, submarine: 0, cruiser: 5, stealthTank: 25, rocketTruck: 45, fighter: 5, bomber: 5, turret: 15, warmachine: 10, spider: 45, lancer: 30, vulture: 55, jammer: 55, blockade: 5 },
  jammer:      { infantry: 0, bazooka: 0, recon: 0, lightTank: 0, heavyTank: 0, artillery: 0, antiAir: 0, helicopter: 0, skylift: 0, barge: 0, cutter: 0, frigate: 0, destroyer: 0, submarine: 0, cruiser: 0, stealthTank: 0, rocketTruck: 0, fighter: 0, bomber: 0, turret: 0, warmachine: 0, spider: 0, lancer: 0, vulture: 0, jammer: 0, blockade: 0 },
  blockade:    { infantry: 0, bazooka: 0, recon: 0, lightTank: 0, heavyTank: 0, artillery: 0, antiAir: 0, helicopter: 0, skylift: 0, barge: 0, cutter: 0, frigate: 0, destroyer: 0, submarine: 0, cruiser: 0, stealthTank: 0, rocketTruck: 0, fighter: 0, bomber: 0, turret: 0, warmachine: 0, spider: 0, lancer: 0, vulture: 0, jammer: 0, blockade: 0 },
};

/** Each owned Airbase / Port takes this much off air / sea unit prices... */
export const CONTROL_DISCOUNT = 0.05;
/** ...up to this much in total. */
export const MAX_CONTROL_DISCOUNT = 0.2;

export const CAPTURE_POINTS = 20;
export const INCOME_PER_PROPERTY = 1000;
export const REPAIR_PER_TURN = 20;
export const MAX_HP = 100;
/** Sight radius of owned properties under fog of war. */
export const PROPERTY_VISION = 2;
/** Extra sight for foot units standing on a mountain. */
export const MOUNTAIN_VISION_BONUS = 2;
/** Indirect fire into high ground loses this fraction. */
export const HIGH_GROUND_REDUCTION = 0.25;
