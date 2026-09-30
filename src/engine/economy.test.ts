import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { applyCommand, nextUpgrade } from './game';
import { createGame, incomeFor, tileAt, unitCost } from './state';
import type { MapDef } from './types';

const OIL: MapDef = {
  name: 'Oil',
  grid: ['HR.....', '.......', '.......', '.......', '.....RH'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 1, y: 0, owner: 'red' },
    { x: 6, y: 4, owner: 'blue' },
    { x: 5, y: 4, owner: 'blue' },
  ],
  units: [
    { type: 'infantry', owner: 'red', x: 0, y: 1 },
    { type: 'infantry', owner: 'blue', x: 6, y: 3 },
  ],
  startingFunds: 20000,
};

describe('refinery upgrades', () => {
  it('pay more each tier, cost money, and stop at the top tier', () => {
    let s = createGame(OIL);
    expect(incomeFor(s, 'red')).toBe(1000 + 2000);
    const funds = s.funds.red;
    expect(nextUpgrade(s, 1, 0)).toMatchObject({ cost: 6000, income: 3500, level: 2 });
    s = applyCommand(s, { kind: 'upgrade', at: { x: 1, y: 0 } }).state;
    expect(s.funds.red).toBe(funds - 6000);
    expect(incomeFor(s, 'red')).toBe(1000 + 3500);
    s = applyCommand(s, { kind: 'upgrade', at: { x: 1, y: 0 } }).state;
    expect(incomeFor(s, 'red')).toBe(1000 + 5000);
    expect(nextUpgrade(s, 1, 0)).toBeNull();
    expect(() => applyCommand(s, { kind: 'upgrade', at: { x: 1, y: 0 } })).toThrow(/Nothing to upgrade/);
    // Not someone else's, and not a city.
    expect(() => applyCommand(s, { kind: 'upgrade', at: { x: 5, y: 4 } })).toThrow(/Nothing to upgrade/);
    expect(() => applyCommand(s, { kind: 'upgrade', at: { x: 0, y: 0 } })).toThrow(/Nothing to upgrade/);
  });

  it('a captured refinery keeps its tier for the new owner', () => {
    let s = createGame(OIL);
    s = applyCommand(s, { kind: 'upgrade', at: { x: 1, y: 0 } }).state;
    tileAt(s, 1, 0).owner = 'blue'; // as if captured
    expect(incomeFor(s, 'blue')).toBe(1000 + 2000 + 3500);
  });

  it('the AI spends spare money on upgrades (not on easy)', () => {
    const s = createGame({ ...OIL, units: [{ type: 'infantry', owner: 'red', x: 0, y: 1 }, { type: 'infantry', owner: 'blue', x: 6, y: 3 }] });
    const next = (d: 'easy' | 'normal') => {
      let state = s;
      let cmd = nextAiCommand(state, d);
      for (let i = 0; i < 10 && cmd.kind === 'move'; i++) {
        state = applyCommand(state, cmd).state;
        cmd = nextAiCommand(state, d);
      }
      return cmd;
    };
    expect(next('normal')).toMatchObject({ kind: 'upgrade', at: { x: 1, y: 0 } });
    expect(next('easy').kind).toBe('endTurn');
  });
});

describe('control discounts', () => {
  it('Airbases cut air prices and Ports cut ship prices, 5% each up to 20%', () => {
    const grid = ['HAAPPPPP', '........', '........', '........', '.......H'];
    const props = [0, 1, 2, 3, 4, 5, 6, 7].map((x) => ({ x, y: 0, owner: 'red' as const }));
    const s = createGame({ ...OIL, grid, properties: [...props, { x: 7, y: 4, owner: 'blue' }] });
    expect(unitCost(s, 'red', 'skylift')).toBe(3600); // 2 airbases: -10%
    expect(unitCost(s, 'red', 'destroyer')).toBe(11200); // 5 ports: capped at -20%
    expect(unitCost(s, 'red', 'lightTank')).toBe(7000);
    expect(unitCost(s, 'blue', 'skylift')).toBe(4000);
  });
});
