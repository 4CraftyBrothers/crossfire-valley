import { describe, expect, it } from 'vitest';
import { attackableTargets, computeDamage } from './combat';
import { applyCommand } from './game';
import { key, reachableTiles } from './movement';
import { createGame, unitById } from './state';
import { canSeeUnit } from './vision';
import type { GameState, MapDef } from './types';

const FIELD: MapDef = {
  name: 'Field',
  grid: ['H.......', '...m....', '........', '........', '.......H'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 7, y: 4, owner: 'blue' },
  ],
  units: [],
  startingFunds: 0,
};
const at = (s: GameState, x: number, y: number) => s.units.find((u) => u.x === x && u.y === y)!;
const game = (units: MapDef['units'], grid = FIELD.grid) => createGame({ ...FIELD, grid, units });
const attack = (s: GameState, a: { id: number; x: number; y: number }, targetId: number) =>
  applyCommand(s, { kind: 'move', unitId: a.id, to: { x: a.x, y: a.y }, action: { type: 'attack', targetId } });

describe('Book III specialists', () => {
  it('a Spider climbs mountains, and what it hits can’t shoot back', () => {
    const s = game([
      { type: 'spider', owner: 'red', x: 2, y: 1 },
      { type: 'lightTank', owner: 'blue', x: 3, y: 2 },
      { type: 'infantry', owner: 'blue', x: 7, y: 3 },
    ]);
    expect(reachableTiles(s, at(s, 2, 1)).has(key(3, 1))).toBe(true); // the mountain
    const r = applyCommand(s, { kind: 'move', unitId: at(s, 2, 1).id, to: { x: 3, y: 1 }, action: { type: 'attack', targetId: at(s, 3, 2).id } });
    expect(r.events.filter((e) => e.type === 'damage')).toHaveLength(1); // no counter
  });

  it('a Lancer’s shot carries through to the enemy behind', () => {
    const s = game([
      { type: 'lancer', owner: 'red', x: 1, y: 2 },
      { type: 'infantry', owner: 'blue', x: 2, y: 2 },
      { type: 'infantry', owner: 'blue', x: 3, y: 2 },
    ]);
    const behind = at(s, 3, 2).id;
    const r = attack(s, at(s, 1, 2), at(s, 2, 2).id);
    expect(unitById(r.state, behind)!.hp).toBeLessThan(100);
  });

  it('a Vulture that makes a kill may act again', () => {
    const s = game([
      { type: 'vulture', owner: 'red', x: 1, y: 2 },
      { type: 'infantry', owner: 'blue', x: 2, y: 2 },
      { type: 'infantry', owner: 'blue', x: 6, y: 3 },
    ]);
    at(s, 2, 2).hp = 20;
    const r = attack(s, at(s, 1, 2), at(s, 2, 2).id);
    expect(at(r.state, 1, 2).acted).toBe(false);
  });

  it('a Jammer reveals cloaked units within 3 tiles', () => {
    const s = game([
      { type: 'jammer', owner: 'red', x: 1, y: 2 },
      { type: 'stealthTank', owner: 'blue', x: 4, y: 2 },
      { type: 'stealthTank', owner: 'blue', x: 6, y: 2 },
    ]);
    expect(canSeeUnit(s, 'red', at(s, 4, 2))).toBe(true);
    expect(canSeeUnit(s, 'red', at(s, 6, 2))).toBe(false);
  });

  it('a Blockade never moves, never fires, and never shoots back', () => {
    const s = game([
      { type: 'infantry', owner: 'red', x: 1, y: 2 },
      { type: 'blockade', owner: 'blue', x: 2, y: 2 },
      { type: 'infantry', owner: 'blue', x: 6, y: 3 },
    ]);
    const wall = at(s, 2, 2);
    expect([...reachableTiles(s, wall).keys()]).toEqual(['2,2']);
    expect(attackableTargets(s, wall, 2, 2, false)).toHaveLength(0);
    expect(attack(s, at(s, 1, 2), wall.id).events.filter((e) => e.type === 'damage')).toHaveLength(1);
  });
});

describe('Book III terrain', () => {
  const grid = ['H.......', '..gy....', '...a....', '........', '.......H'];

  it('ash burns ground units that start their turn on it', () => {
    let s = game([{ type: 'infantry', owner: 'red', x: 3, y: 2 }, { type: 'infantry', owner: 'blue', x: 7, y: 3 }], grid);
    s = applyCommand(applyCommand(s, { kind: 'endTurn' }).state, { kind: 'endTurn' }).state;
    expect(at(s, 3, 2).hp).toBe(90);
  });

  it('a ridge blunts indirect fire; a canyon stops it being fired from', () => {
    const s = game(
      [
        { type: 'artillery', owner: 'red', x: 0, y: 1 },
        { type: 'artillery', owner: 'red', x: 3, y: 1 },
        { type: 'infantry', owner: 'blue', x: 2, y: 1 },
        { type: 'infantry', owner: 'blue', x: 5, y: 1 },
      ],
      grid,
    );
    const onRidge = at(s, 2, 1);
    const plain = computeDamage(s, at(s, 0, 1), { ...onRidge, x: 1, y: 1 });
    expect(computeDamage(s, at(s, 0, 1), onRidge)).toBeLessThan(plain);
    expect(attackableTargets(s, at(s, 3, 1), 3, 1, false)).toHaveLength(0); // inside the canyon
  });
});
