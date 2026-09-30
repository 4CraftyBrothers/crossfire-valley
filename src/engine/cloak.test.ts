import { afterEach, describe, expect, it } from 'vitest';
import { attackableTargets, computeDamage, forecastAttack } from './combat';
import { UNIT_DATA, type UnitMods } from './data';
import { applyCommand } from './game';
import { key, reachableTiles } from './movement';
import { createGame, unitById } from './state';
import { canSeeUnit } from './vision';
import type { GameState, MapDef } from './types';

const OPEN: MapDef = {
  name: 'Open',
  grid: ['H.......', '........', '........', '........', '.......H'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 7, y: 4, owner: 'blue' },
  ],
  units: [
    { type: 'stealthTank', owner: 'blue', x: 4, y: 2 },
    { type: 'infantry', owner: 'red', x: 1, y: 2 },
    { type: 'artillery', owner: 'red', x: 4, y: 4 },
    { type: 'infantry', owner: 'blue', x: 7, y: 3 },
  ],
  startingFunds: 0,
};

const at = (s: GameState, x: number, y: number) => s.units.find((u) => u.x === x && u.y === y)!;

const saved: [keyof typeof UNIT_DATA, UnitMods | undefined][] = [];
afterEach(() => {
  while (saved.length) {
    const [t, m] = saved.pop()!;
    UNIT_DATA[t].mods = m;
  }
});

describe('cloaking', () => {
  it('hides a Stealth Tank from the enemy even without fog, until something is next to it', () => {
    let s = createGame(OPEN);
    const tank = at(s, 4, 2);
    expect(canSeeUnit(s, 'red', tank)).toBe(false);
    expect(canSeeUnit(s, 'blue', tank)).toBe(true);
    // The artillery two tiles away can't shoot what nobody has found.
    expect(attackableTargets(s, at(s, 4, 4), 4, 4, false)).toHaveLength(0);

    // A red soldier walks up beside it: now everyone on Red can see it.
    s = applyCommand(s, { kind: 'move', unitId: at(s, 1, 2).id, to: { x: 3, y: 2 }, action: { type: 'wait' } }).state;
    expect(canSeeUnit(s, 'red', unitById(s, tank.id)!)).toBe(true);
    expect(attackableTargets(s, at(s, 4, 4), 4, 4, false).map((t) => t.id)).toEqual([tank.id]);
  });

  it('does not block movement it can’t be seen in: walking into it is an ambush', () => {
    const s = createGame(OPEN);
    const inf = at(s, 1, 2);
    // Red thinks the tank's tile is open ground.
    expect(reachableTiles(s, { ...inf, x: 2, y: 2 }).has(key(4, 2))).toBe(true);
    const r = applyCommand(s, { kind: 'move', unitId: inf.id, to: { x: 4, y: 2 }, action: { type: 'wait' } });
    expect(r.events.some((e) => e.type === 'ambushed')).toBe(true);
    expect(unitById(r.state, inf.id)).toMatchObject({ x: 3, y: 2 });
  });

  it('infantry track what they bump into and attack it', () => {
    const s = createGame(OPEN);
    const inf = at(s, 1, 2);
    const r = applyCommand(s, { kind: 'move', unitId: inf.id, to: { x: 4, y: 2 }, action: { type: 'wait' } });
    const hit = r.events.find((e) => e.type === 'damage' && e.targetId === at(s, 4, 2).id);
    expect(hit).toBeDefined();
  });

  it('strikes for double damage from hiding, and the forecast knows it', () => {
    let s = createGame(OPEN);
    s = applyCommand(s, { kind: 'endTurn' }).state; // Blue's turn
    const tank = at(s, 4, 2);
    const art = at(s, 4, 4);
    const plain = computeDamage(s, { ...tank, x: 4, y: 3 }, art);
    const f = forecastAttack(s, tank, { x: 4, y: 3 }, art);
    expect(f.damage).toBe(Math.min(art.hp, plain * 2));
    const r = applyCommand(s, { kind: 'move', unitId: tank.id, to: { x: 4, y: 3 }, action: { type: 'attack', targetId: art.id } });
    expect(100 - (unitById(r.state, art.id)?.hp ?? 0)).toBe(f.damage);
  });

  it('jamming reveals cloaked units within its radius', () => {
    saved.push(['artillery', UNIT_DATA.artillery.mods]);
    UNIT_DATA.artillery.mods = { jamming: 2 };
    const s = createGame(OPEN);
    expect(canSeeUnit(s, 'red', at(s, 4, 2))).toBe(true);
  });

  it('a campaign roster keeps factories to the Book’s units', () => {
    const s = createGame(
      { ...OPEN, grid: ['HF......', '........', '........', '........', '.......H'], properties: [...OPEN.properties, { x: 1, y: 0, owner: 'red' }], startingFunds: 20000 },
      { roster: ['infantry'] },
    );
    expect(() => applyCommand(s, { kind: 'build', at: { x: 1, y: 0 }, unitType: 'stealthTank' })).toThrow(/Not available/);
    expect(applyCommand(s, { kind: 'build', at: { x: 1, y: 0 }, unitType: 'infantry' }).events[0].type).toBe('built');
  });
});
