import type { MoveClass, Terrain, UnitType } from './types';

export interface UnitData {
  name: string;
  cost: number;
  move: number;
  moveClass: MoveClass;
  /** Inclusive attack range. Direct units are 1-1; indirect can't move and fire. */
  minRange: number;
  maxRange: number;
  canCapture: boolean;
  /** Fog of war sight radius (manhattan). */
  vision: number;
}

export const UNIT_DATA: Record<UnitType, UnitData> = {
  infantry:  { name: 'Infantry',   cost: 1000,  move: 3, moveClass: 'foot',   minRange: 1, maxRange: 1, canCapture: true,  vision: 2 },
  bazooka:   { name: 'Bazooka',    cost: 2500,  move: 2, moveClass: 'foot',   minRange: 1, maxRange: 1, canCapture: true,  vision: 2 },
  recon:     { name: 'Recon',      cost: 4000,  move: 8, moveClass: 'tires',  minRange: 1, maxRange: 1, canCapture: false, vision: 5 },
  lightTank: { name: 'Light Tank', cost: 7000,  move: 6, moveClass: 'treads', minRange: 1, maxRange: 1, canCapture: false, vision: 3 },
  heavyTank: { name: 'Heavy Tank', cost: 16000, move: 5, moveClass: 'treads', minRange: 1, maxRange: 1, canCapture: false, vision: 2 },
  artillery: { name: 'Artillery',  cost: 6000,  move: 4, moveClass: 'treads', minRange: 2, maxRange: 3, canCapture: false, vision: 2 },
};

export const BUILDABLE_UNITS: UnitType[] = [
  'infantry',
  'bazooka',
  'recon',
  'artillery',
  'lightTank',
  'heavyTank',
];

export interface TerrainData {
  name: string;
  defenseStars: number;
  /** Movement cost per move class; null = impassable. */
  moveCost: Record<MoveClass, number | null>;
  capturable: boolean;
}

export const TERRAIN_DATA: Record<Terrain, TerrainData> = {
  plain:    { name: 'Plains',   defenseStars: 1, moveCost: { foot: 1, tires: 2, treads: 1 },       capturable: false },
  road:     { name: 'Road',     defenseStars: 0, moveCost: { foot: 1, tires: 1, treads: 1 },       capturable: false },
  forest:   { name: 'Forest',   defenseStars: 2, moveCost: { foot: 1, tires: 3, treads: 2 },       capturable: false },
  mountain: { name: 'Mountain', defenseStars: 4, moveCost: { foot: 2, tires: null, treads: null }, capturable: false },
  water:    { name: 'Water',    defenseStars: 0, moveCost: { foot: null, tires: null, treads: null }, capturable: false },
  city:     { name: 'City',     defenseStars: 3, moveCost: { foot: 1, tires: 1, treads: 1 },       capturable: true },
  factory:  { name: 'Factory',  defenseStars: 3, moveCost: { foot: 1, tires: 1, treads: 1 },       capturable: true },
  hq:       { name: 'HQ',       defenseStars: 4, moveCost: { foot: 1, tires: 1, treads: 1 },       capturable: true },
};

/**
 * Base damage percent dealt by a full-health attacker to a full-health
 * defender on 0-star terrain. Rows: attacker. Columns: defender.
 */
export const DAMAGE: Record<UnitType, Record<UnitType, number>> = {
  //           vs:  infantry bazooka recon lightTank heavyTank artillery
  infantry:  { infantry: 55, bazooka: 45, recon: 12, lightTank: 5,  heavyTank: 1,   artillery: 15 },
  bazooka:   { infantry: 65, bazooka: 55, recon: 85, lightTank: 55, heavyTank: 15,  artillery: 70 },
  recon:     { infantry: 70, bazooka: 65, recon: 35, lightTank: 6,  heavyTank: 1,   artillery: 45 },
  lightTank: { infantry: 75, bazooka: 70, recon: 85, lightTank: 55, heavyTank: 15,  artillery: 70 },
  heavyTank: { infantry: 105, bazooka: 95, recon: 105, lightTank: 85, heavyTank: 55, artillery: 105 },
  artillery: { infantry: 90, bazooka: 85, recon: 80, lightTank: 70, heavyTank: 45,  artillery: 75 },
};

export const CAPTURE_POINTS = 20;
export const INCOME_PER_PROPERTY = 1000;
export const REPAIR_PER_TURN = 20;
export const MAX_HP = 100;
/** Sight radius of owned properties under fog of war. */
export const PROPERTY_VISION = 2;
/** Extra sight for foot units standing on a mountain. */
export const MOUNTAIN_VISION_BONUS = 2;
