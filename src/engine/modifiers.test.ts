import { afterEach, describe, expect, it } from 'vitest';
import { attackableTargets, canCounter, computeDamage } from './combat';
import { TERRAIN_DATA, UNIT_DATA, type UnitMods } from './data';
import { applyCommand } from './game';
import { key, reachableTiles } from './movement';
import { createGame, unitById } from './state';
import type { GameState, MapDef, UnitType } from './types';

// Modifiers are data on unit types. No Book I unit has any, so the tests
// switch them on for the duration of a test and restore afterwards.
const saved: [UnitType, UnitMods | undefined][] = [];
function withMods(type: UnitType, mods: UnitMods): void {
  saved.push([type, UNIT_DATA[type].mods]);
  UNIT_DATA[type].mods = mods;
}
afterEach(() => {
  while (saved.length) {
    const [type, mods] = saved.pop()!;
    UNIT_DATA[type].mods = mods;
  }
  delete TERRAIN_DATA.plain.hazard;
  delete TERRAIN_DATA.mountain.highGround;
  delete TERRAIN_DATA.forest.canopy;
});

const MAP: MapDef = {
  name: 'Mods',
  grid: ['H.......', '........', '........', '........', '.......H'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 7, y: 4, owner: 'blue' },
  ],
  units: [],
  startingFunds: 0,
};

function game(units: MapDef['units']): GameState {
  return createGame({ ...MAP, units });
}
const at = (s: GameState, x: number, y: number) => s.units.find((u) => u.x === x && u.y === y)!;
const attack = (s: GameState, attacker: { id: number; x: number; y: number }, targetId: number) =>
  applyCommand(s, { kind: 'move', unitId: attacker.id, to: { x: attacker.x, y: attacker.y }, action: { type: 'attack', targetId } });

describe('combat modifiers', () => {
  it('blitz boosts initiated attacks only', () => {
    const s = game([
      { type: 'lightTank', owner: 'red', x: 1, y: 1 },
      { type: 'infantry', owner: 'blue', x: 2, y: 1 },
    ]);
    const plain = computeDamage(s, at(s, 1, 1), at(s, 2, 1));
    withMods('lightTank', { blitz: 0.2 });
    expect(Math.abs(computeDamage(s, at(s, 1, 1), at(s, 2, 1)) - plain * 1.2)).toBeLessThanOrEqual(1);
    expect(computeDamage(s, at(s, 1, 1), at(s, 2, 1), true)).toBe(plain);
  });

  it('mammoth weakens and courage strengthens counter-attacks', () => {
    const s = game([
      { type: 'heavyTank', owner: 'red', x: 1, y: 1 },
      { type: 'lightTank', owner: 'blue', x: 2, y: 1 },
    ]);
    const plain = computeDamage(s, at(s, 1, 1), at(s, 2, 1), true);
    withMods('heavyTank', { mammoth: 0.15 });
    expect(Math.abs(computeDamage(s, at(s, 1, 1), at(s, 2, 1), true) - plain * 0.85)).toBeLessThanOrEqual(1);
    withMods('heavyTank', { courage: 0.25 });
    expect(Math.abs(computeDamage(s, at(s, 1, 1), at(s, 2, 1), true) - plain * 1.25)).toBeLessThanOrEqual(1);
  });

  it('noCounter and stun both suppress the return fire', () => {
    const base = () =>
      game([
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'infantry', owner: 'blue', x: 2, y: 1 },
      ]);
    let s = base();
    expect(attack(s, at(s, 1, 1), at(s, 2, 1).id).events.filter((e) => e.type === 'damage')).toHaveLength(2);
    withMods('infantry', { noCounter: true });
    s = base();
    expect(attack(s, at(s, 1, 1), at(s, 2, 1).id).events.filter((e) => e.type === 'damage')).toHaveLength(1);
    withMods('infantry', { stun: true });
    s = base();
    expect(attack(s, at(s, 1, 1), at(s, 2, 1).id).events.filter((e) => e.type === 'damage')).toHaveLength(1);
  });

  it('counter-battery lets artillery answer artillery within range', () => {
    const s = game([
      { type: 'artillery', owner: 'red', x: 1, y: 1 },
      { type: 'artillery', owner: 'blue', x: 3, y: 1 },
    ]);
    expect(canCounter(at(s, 1, 1), at(s, 3, 1))).toBe(false);
    withMods('artillery', { counterBattery: true });
    expect(canCounter(at(s, 1, 1), at(s, 3, 1))).toBe(true);
    const { events } = attack(s, at(s, 1, 1), at(s, 3, 1).id);
    expect(events.filter((e) => e.type === 'damage')).toHaveLength(2);
  });

  it('piercing splashes the enemy directly behind the target', () => {
    withMods('lightTank', { piercing: 0.5 });
    const s = game([
      { type: 'lightTank', owner: 'red', x: 1, y: 1 },
      { type: 'infantry', owner: 'blue', x: 2, y: 1 },
      { type: 'infantry', owner: 'blue', x: 3, y: 1 },
      { type: 'infantry', owner: 'blue', x: 2, y: 2 }, // off the line of fire
    ]);
    const behindId = at(s, 3, 1).id;
    const asideId = at(s, 2, 2).id;
    const { state, events } = attack(s, at(s, 1, 1), at(s, 2, 1).id);
    expect(events.filter((e) => e.type === 'damage' && e.targetId === behindId)).toHaveLength(1);
    expect(unitById(state, behindId)!.hp).toBeLessThan(100);
    expect(unitById(state, asideId)!.hp).toBe(100);
  });

  it('scavenge grants one extra action per turn after a kill', () => {
    withMods('heavyTank', { scavenge: true });
    const s = game([
      { type: 'heavyTank', owner: 'red', x: 1, y: 1 },
      { type: 'infantry', owner: 'blue', x: 2, y: 1 },
      { type: 'infantry', owner: 'blue', x: 1, y: 2 },
      { type: 'infantry', owner: 'blue', x: 6, y: 4 },
    ]);
    at(s, 2, 1).hp = 30;
    at(s, 1, 2).hp = 30;
    let r = attack(s, at(s, 1, 1), at(s, 2, 1).id);
    let tank = at(r.state, 1, 1);
    expect(unitById(r.state, tank.id)!.acted).toBe(false);
    expect(tank.scavenged).toBe(true);
    r = attack(r.state, tank, at(r.state, 1, 2).id);
    tank = at(r.state, 1, 1);
    expect(tank.acted).toBe(true); // second kill: no third action
    r = applyCommand(r.state, { kind: 'endTurn' });
    r = applyCommand(r.state, { kind: 'endTurn' });
    expect(at(r.state, 1, 1).scavenged).toBe(false);
  });

  it('heal restores HP at the owner\'s turn start', () => {
    withMods('recon', { heal: 20 });
    let s = game([
      { type: 'recon', owner: 'red', x: 1, y: 1 },
      { type: 'infantry', owner: 'blue', x: 6, y: 3 },
    ]);
    at(s, 1, 1).hp = 50;
    s = applyCommand(s, { kind: 'endTurn' }).state;
    expect(at(s, 1, 1).hp).toBe(50);
    s = applyCommand(s, { kind: 'endTurn' }).state;
    expect(at(s, 1, 1).hp).toBe(70);
  });

  it('submerged units can only be targeted by anti-sub attackers', () => {
    withMods('heavyTank', { submerged: true });
    const s = game([
      { type: 'infantry', owner: 'red', x: 1, y: 1 },
      { type: 'lightTank', owner: 'red', x: 1, y: 2 },
      { type: 'heavyTank', owner: 'blue', x: 2, y: 1 },
    ]);
    expect(attackableTargets(s, at(s, 1, 1), 1, 1, false)).toHaveLength(0);
    withMods('lightTank', { antiSub: true });
    expect(attackableTargets(s, at(s, 1, 2), 2, 2, true)).toHaveLength(1);
  });
});

describe('terrain modifiers', () => {
  it('hazard tiles damage grounded units at turn start and can kill', () => {
    TERRAIN_DATA.plain.hazard = 60;
    let s = game([
      { type: 'infantry', owner: 'red', x: 1, y: 1 },
      { type: 'helicopter', owner: 'blue', x: 6, y: 3 },
    ]);
    s = applyCommand(s, { kind: 'endTurn' }).state; // blue: helicopter immune
    expect(at(s, 6, 3).hp).toBe(100);
    s = applyCommand(s, { kind: 'endTurn' }).state; // red day 2
    expect(at(s, 1, 1).hp).toBe(40);
    const r = applyCommand(applyCommand(s, { kind: 'endTurn' }).state, { kind: 'endTurn' });
    expect(r.state.units.find((u) => u.owner === 'red')).toBeUndefined();
    expect(r.state.winner).toBe('blue');
  });

  it('high ground blunts indirect fire; canopy silences it', () => {
    const s = createGame({
      ...MAP,
      grid: ['H.......', '...m....', '..f.....', '........', '.......H'],
      units: [
        { type: 'artillery', owner: 'red', x: 1, y: 1 },
        { type: 'artillery', owner: 'red', x: 2, y: 2 },
        { type: 'infantry', owner: 'blue', x: 3, y: 1 },
      ],
    });
    const plain = computeDamage(s, at(s, 1, 1), at(s, 3, 1));
    TERRAIN_DATA.mountain.highGround = true;
    expect(computeDamage(s, at(s, 1, 1), at(s, 3, 1))).toBeLessThan(plain);
    expect(attackableTargets(s, at(s, 2, 2), 2, 2, false)).toHaveLength(1);
    TERRAIN_DATA.forest.canopy = true;
    expect(attackableTargets(s, at(s, 2, 2), 2, 2, false)).toHaveLength(0);
  });

  it('massive hulls cannot enter shallows', () => {
    withMods('helicopter', { massiveHull: true });
    const s = createGame({
      ...MAP,
      grid: ['H.......', '.x......', '........', '........', '.......H'],
      units: [
        { type: 'helicopter', owner: 'red', x: 0, y: 1 },
        { type: 'infantry', owner: 'blue', x: 6, y: 3 },
      ],
    });
    expect(reachableTiles(s, at(s, 0, 1)).has(key(1, 1))).toBe(false);
    expect(reachableTiles(s, at(s, 0, 1)).has(key(2, 1))).toBe(true);
  });
});
