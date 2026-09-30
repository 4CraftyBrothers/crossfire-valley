import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { applyCommand, canBuildAt } from './game';
import { validateMapDef } from './serialize';
import { createGame, tileAt, unitById } from './state';
import type { GameState, MapDef } from './types';

// No factories: each side has a Warmachine, and there is ore to mine.
const BLITZ: MapDef = {
  name: 'Blitz',
  grid: ['H.o.....', '........', '..w.....', '.....o..', '.......H'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 7, y: 4, owner: 'blue' },
  ],
  units: [
    { type: 'warmachine', owner: 'red', x: 1, y: 1 },
    { type: 'warmachine', owner: 'blue', x: 6, y: 3 },
    { type: 'infantry', owner: 'blue', x: 7, y: 3 },
  ],
  startingFunds: 5000,
};
const at = (s: GameState, x: number, y: number) => s.units.find((u) => u.x === x && u.y === y)!;

describe('blitz', () => {
  it('a Warmachine builds on a free neighbouring tile, and that is its turn', () => {
    expect(validateMapDef(BLITZ)).toEqual([]);
    const s = createGame(BLITZ);
    const wm = at(s, 1, 1);
    expect(canBuildAt(s, 1, 2)).toBe(true);
    expect(canBuildAt(s, 3, 3)).toBe(false); // not next to it
    const funds = s.funds.red;
    const r = applyCommand(s, { kind: 'build', at: { x: 1, y: 2 }, unitType: 'infantry' });
    expect(r.state.funds.red).toBe(funds - 1000);
    expect(unitById(r.state, wm.id)!.acted).toBe(true);
    expect(at(r.state, 1, 2)).toMatchObject({ type: 'infantry', acted: true });
    // Spent: no second build this turn, and it can't move either.
    expect(canBuildAt(r.state, 2, 1)).toBe(false);
    expect(() => applyCommand(r.state, { kind: 'build', at: { x: 2, y: 1 }, unitType: 'infantry' })).toThrow(/Not a factory/);
  });

  it('won’t put a unit where it can’t stand', () => {
    const s = createGame({ ...BLITZ, startingFunds: 20000, units: [{ type: 'warmachine', owner: 'red', x: 1, y: 2 }, BLITZ.units[1], BLITZ.units[2]] });
    expect(() => applyCommand(s, { kind: 'build', at: { x: 2, y: 2 }, unitType: 'lightTank' })).toThrow(/Cannot build that here/);
    expect(applyCommand(s, { kind: 'build', at: { x: 2, y: 2 }, unitType: 'helicopter' }).events[0].type).toBe('built');
  });

  it('mines $1500 a turn parked on ore', () => {
    let s = createGame(BLITZ);
    const wm = at(s, 1, 1);
    s = applyCommand(s, { kind: 'move', unitId: wm.id, to: { x: 2, y: 0 }, action: { type: 'wait' } }).state;
    s = applyCommand(s, { kind: 'endTurn' }).state;
    const before = s.funds.red;
    const r = applyCommand(s, { kind: 'endTurn' });
    expect(r.state.funds.red - before).toBe(1000 + 1500); // HQ + ore
  });

  it('losing the last Warmachine loses the game, even with troops left', () => {
    let s = createGame({ ...BLITZ, units: [...BLITZ.units, { type: 'bomber', owner: 'red', x: 5, y: 2 }] });
    const blueWm = at(s, 6, 3);
    blueWm.hp = 10;
    s = applyCommand(s, { kind: 'move', unitId: at(s, 5, 2).id, to: { x: 6, y: 2 }, action: { type: 'attack', targetId: blueWm.id } }).state;
    expect(s.winner).toBe('red');
    expect(s.units.some((u) => u.owner === 'blue')).toBe(true); // the infantry is still standing
  });

  it('the AI drives its Warmachine onto ore, then builds from there', () => {
    let s = createGame(BLITZ);
    let built = false;
    for (let i = 0; i < 200 && s.day <= 4 && !s.winner; i++) {
      const cmd = nextAiCommand(s, 'normal');
      if (cmd.kind === 'build' && s.current === 'red') built = true;
      s = applyCommand(s, cmd).state;
    }
    const wm = s.units.find((u) => u.owner === 'red' && u.type === 'warmachine')!;
    expect(tileAt(s, wm.x, wm.y).terrain).toBe('ore');
    expect(built).toBe(true);
  });
});
