import { describe, expect, it } from 'vitest';
import { applyCommand } from '../engine/game';
import { key, pathBetween, reachableTiles } from '../engine/movement';
import { createGame, unitAt } from '../engine/state';
import type { MapDef } from '../engine/types';
import { CROSSFIRE_VALLEY } from '../maps';
import { nextAiCommand } from './ai';

function testMap(overrides: Partial<MapDef> = {}): MapDef {
  return {
    name: 'Test',
    grid: [
      '.......',
      '.f.m...',
      '.F.w.c.',
      '.H....H',
      '.......',
    ],
    properties: [
      { x: 1, y: 2, owner: 'red' },
      { x: 1, y: 3, owner: 'red' },
      { x: 6, y: 3, owner: 'blue' },
    ],
    units: [],
    startingFunds: 0,
    ...overrides,
  };
}

describe('pathBetween', () => {
  it('returns a contiguous cheapest path around obstacles', () => {
    const state = createGame(
      testMap({ units: [{ type: 'lightTank', owner: 'red', x: 2, y: 1 }] }),
    );
    const tank = unitAt(state, 2, 1)!;
    // (4,2) is right of the water at (3,2): the tank must route around.
    const path = pathBetween(state, tank, { x: 4, y: 2 });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 2, y: 1 });
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 2 });
    for (let i = 1; i < path!.length; i++) {
      const dx = Math.abs(path![i].x - path![i - 1].x);
      const dy = Math.abs(path![i].y - path![i - 1].y);
      expect(dx + dy).toBe(1); // orthogonally contiguous
      expect(path![i]).not.toEqual({ x: 3, y: 2 }); // never through water
    }
  });

  it('agrees with reachableTiles and rejects unreachable destinations', () => {
    const state = createGame(
      testMap({ units: [{ type: 'infantry', owner: 'red', x: 0, y: 0 }] }),
    );
    const inf = unitAt(state, 0, 0)!;
    const reach = reachableTiles(state, inf);
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      expect(pathBetween(state, inf, { x, y }), k).not.toBeNull();
    }
    expect(pathBetween(state, inf, { x: 6, y: 4 })).toBeNull(); // out of range
    expect(reach.has(key(6, 4))).toBe(false);
  });
});

describe('AI difficulty', () => {
  it('easy never builds heavy tanks even when rich', () => {
    const state = createGame(testMap({ startingFunds: 50000, units: [
      { type: 'infantry', owner: 'red', x: 0, y: 0 },
      { type: 'infantry', owner: 'red', x: 0, y: 1 },
      { type: 'infantry', owner: 'red', x: 0, y: 2 },
      { type: 'infantry', owner: 'red', x: 0, y: 4 },
      { type: 'infantry', owner: 'blue', x: 6, y: 4 },
    ] }));
    // All red units acted so the AI goes straight to the build phase.
    for (const u of state.units) if (u.owner === 'red') u.acted = true;
    for (let i = 0; i < 25; i++) {
      const cmd = nextAiCommand(state, 'easy');
      expect(cmd.kind).toBe('build');
      if (cmd.kind === 'build') expect(cmd.unitType).not.toBe('heavyTank');
    }
  });

  it('hard counter-builds against an armor-heavy enemy', () => {
    const state = createGame(testMap({ startingFunds: 16000, units: [
      { type: 'infantry', owner: 'red', x: 0, y: 0 },
      { type: 'infantry', owner: 'red', x: 0, y: 1 },
      { type: 'infantry', owner: 'red', x: 0, y: 2 },
      { type: 'infantry', owner: 'red', x: 0, y: 4 },
      { type: 'lightTank', owner: 'blue', x: 6, y: 4 },
      { type: 'heavyTank', owner: 'blue', x: 5, y: 4 },
    ] }));
    for (const u of state.units) if (u.owner === 'red') u.acted = true;
    const cmd = nextAiCommand(state, 'hard');
    expect(cmd.kind).toBe('build');
    if (cmd.kind === 'build') expect(cmd.unitType).toBe('heavyTank');
  });

  it('easy and hard both play full legal games', () => {
    for (const difficulty of ['easy', 'hard'] as const) {
      let state = createGame(CROSSFIRE_VALLEY);
      let steps = 0;
      while (!state.winner && state.day <= 12 && steps < 3000) {
        state = applyCommand(state, nextAiCommand(state, difficulty)).state;
        steps += 1;
      }
      expect(steps, difficulty).toBeLessThan(3000);
    }
  });
});
