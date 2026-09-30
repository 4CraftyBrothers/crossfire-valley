import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { attackableTargets, canCounter } from './combat';
import { BUILDABLE_UNITS } from './data';
import { applyCommand } from './game';
import { reachableTiles } from './movement';
import { createGame, unitById } from './state';
import type { GameState, MapDef } from './types';

const FIELD: MapDef = {
  name: 'Field',
  grid: ['H.......', '........', '........', '........', '.......H'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 7, y: 4, owner: 'blue' },
  ],
  units: [],
  startingFunds: 0,
};
const at = (s: GameState, x: number, y: number) => s.units.find((u) => u.x === x && u.y === y)!;
const game = (units: MapDef['units']) => createGame({ ...FIELD, units });

describe('Book II units', () => {
  it('a Turret never moves, can’t be built, fires at 2–5 tiles, and repairs itself', () => {
    expect(BUILDABLE_UNITS).not.toContain('turret');
    let s = game([
      { type: 'turret', owner: 'red', x: 1, y: 2 },
      { type: 'infantry', owner: 'blue', x: 4, y: 2 },
      { type: 'infantry', owner: 'blue', x: 2, y: 2 },
    ]);
    const turret = at(s, 1, 2);
    expect([...reachableTiles(s, turret).keys()]).toEqual(['1,2']);
    expect(attackableTargets(s, turret, 1, 2, false).map((t) => `${t.x},${t.y}`)).toEqual(['4,2']);
    turret.hp = 50;
    s = applyCommand(applyCommand(s, { kind: 'endTurn' }).state, { kind: 'endTurn' }).state;
    expect(unitById(s, turret.id)!.hp).toBe(60);
  });

  it('a Fighter only fights aircraft; a Bomber never shoots back', () => {
    const s = game([
      { type: 'fighter', owner: 'red', x: 1, y: 1 },
      { type: 'lightTank', owner: 'blue', x: 2, y: 1 },
      { type: 'helicopter', owner: 'blue', x: 1, y: 2 },
      { type: 'bomber', owner: 'blue', x: 0, y: 1 },
    ]);
    expect(attackableTargets(s, at(s, 1, 1), 1, 1, false).map((t) => t.type).sort()).toEqual(['bomber', 'helicopter']);
    expect(canCounter(at(s, 1, 1), at(s, 0, 1))).toBe(false); // the bomber takes it
  });

  it('a Rocket Truck reaches aircraft 3–5 tiles away', () => {
    const s = game([
      { type: 'rocketTruck', owner: 'red', x: 1, y: 1 },
      { type: 'helicopter', owner: 'blue', x: 5, y: 1 },
      { type: 'infantry', owner: 'blue', x: 2, y: 1 },
    ]);
    expect(attackableTargets(s, at(s, 1, 1), 1, 1, false).map((t) => t.type)).toEqual(['helicopter']);
  });

  it('the AI builds a Fighter at its Airbase against enemy aircraft', () => {
    const s = createGame({
      ...FIELD,
      grid: ['HA......', '........', '........', '........', '.......H'],
      properties: [...FIELD.properties, { x: 1, y: 0, owner: 'red' }],
      units: [
        { type: 'turret', owner: 'red', x: 3, y: 3 }, // can't wander onto the Airbase
        { type: 'helicopter', owner: 'blue', x: 6, y: 3 },
      ],
      startingFunds: { red: 20000, blue: 0 },
    });
    let state = s;
    let cmd = nextAiCommand(state, 'normal');
    for (let i = 0; i < 5 && cmd.kind === 'move'; i++) {
      state = applyCommand(state, cmd).state;
      cmd = nextAiCommand(state, 'normal');
    }
    expect(cmd).toMatchObject({ kind: 'build', unitType: 'fighter' });
  });
});
