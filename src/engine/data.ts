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
  mods?: UnitMods;
}

export const UNIT_DATA: Record<UnitType, UnitData> = {
  infantry:   { name: 'Infantry',   cost: 1000,  move: 3, moveClass: 'foot',   domain: 'ground', minRange: 1, maxRange: 1, canCapture: true,  vision: 2 },
  bazooka:    { name: 'Bazooka',    cost: 2500,  move: 2, moveClass: 'foot',   domain: 'ground', minRange: 1, maxRange: 1, canCapture: true,  vision: 2 },
  recon:      { name: 'Recon',      cost: 4000,  move: 8, moveClass: 'tires',  domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 5 },
  lightTank:  { name: 'Light Tank', cost: 7000,  move: 6, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 3 },
  heavyTank:  { name: 'Heavy Tank', cost: 16000, move: 5, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 2 },
  artillery:  { name: 'Artillery',  cost: 6000,  move: 4, moveClass: 'treads', domain: 'ground', minRange: 2, maxRange: 3, canCapture: false, vision: 2 },
  antiAir:    { name: 'Anti-Air',   cost: 8000,  move: 6, moveClass: 'treads', domain: 'ground', minRange: 1, maxRange: 1, canCapture: false, vision: 2 },
  helicopter: { name: 'Helicopter', cost: 9000,  move: 6, moveClass: 'air',    domain: 'air',    minRange: 1, maxRange: 1, canCapture: false, vision: 4 },
};

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
  shore:    { name: 'Shore',     defenseStars: 0, domain: 'shore', moveCost: { ...LAND },                                                  capturable: false },
  shallow:  { name: 'Shallows',  defenseStars: 0, domain: 'sea',   moveCost: { foot: null, tires: null, treads: null, air: 1, sea: 1 }, capturable: false, shallow: true },
  bridge:   { name: 'Bridge',    defenseStars: 0, domain: 'land',  moveCost: { ...LAND },                                                  capturable: false },
  volcano:  { name: 'Volcano',   defenseStars: 0, domain: 'land',  moveCost: { foot: null, tires: null, treads: null, air: null, sea: null }, capturable: false },
  refinery: { name: 'Refinery',  defenseStars: 2, domain: 'land',  moveCost: { ...LAND },                                                  capturable: true, income: 2000 },
};

/**
 * Base damage percent dealt by a full-health attacker to a full-health
 * defender on 0-star terrain. Rows: attacker. Columns: defender.
 * A value of 0 means the attacker has no weapon against that target
 * (e.g. artillery cannot shell aircraft) — such attacks are illegal.
 */
export const DAMAGE: Record<UnitType, Record<UnitType, number>> = {
  //            vs:  infantry bazooka recon lightTank heavyTank artillery antiAir helicopter
  infantry:   { infantry: 55, bazooka: 45, recon: 12, lightTank: 5,  heavyTank: 1,   artillery: 15,  antiAir: 5,   helicopter: 7 },
  bazooka:    { infantry: 65, bazooka: 55, recon: 85, lightTank: 55, heavyTank: 15,  artillery: 70,  antiAir: 60,  helicopter: 9 },
  recon:      { infantry: 70, bazooka: 65, recon: 35, lightTank: 6,  heavyTank: 1,   artillery: 45,  antiAir: 4,   helicopter: 10 },
  lightTank:  { infantry: 75, bazooka: 70, recon: 85, lightTank: 55, heavyTank: 15,  artillery: 70,  antiAir: 65,  helicopter: 6 },
  heavyTank:  { infantry: 105, bazooka: 95, recon: 105, lightTank: 85, heavyTank: 55, artillery: 105, antiAir: 105, helicopter: 12 },
  artillery:  { infantry: 90, bazooka: 85, recon: 80, lightTank: 70, heavyTank: 45,  artillery: 75,  antiAir: 75,  helicopter: 0 },
  antiAir:    { infantry: 105, bazooka: 105, recon: 60, lightTank: 25, heavyTank: 10, artillery: 50,  antiAir: 45,  helicopter: 120 },
  helicopter: { infantry: 75, bazooka: 75, recon: 55, lightTank: 55, heavyTank: 25,  artillery: 65,  antiAir: 25,  helicopter: 65 },
};

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
