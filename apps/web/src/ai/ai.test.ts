import { describe, expect, it } from 'vitest';
import { applyCommand } from '@crossfire/engine';
import { createGame, tileAt, unitAt } from '@crossfire/engine';
import type { GameState, MapDef } from '@crossfire/engine';
import { CROSSFIRE_VALLEY } from '../maps';
import { nextAiCommand } from './ai';

function testMap(overrides: Partial<MapDef> = {}): MapDef {
  return {
    name: 'AI Test',
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

describe('nextAiCommand', () => {
  it('attacks a killable adjacent enemy', () => {
    const state = createGame(
      testMap({
        units: [
          { type: 'heavyTank', owner: 'red', x: 3, y: 0 },
          { type: 'infantry', owner: 'blue', x: 4, y: 0 },
          { type: 'infantry', owner: 'blue', x: 6, y: 4 },
        ],
      }),
    );
    unitAt(state, 4, 0)!.hp = 30;

    const cmd = nextAiCommand(state);
    expect(cmd.kind).toBe('move');
    if (cmd.kind !== 'move') return;
    expect(cmd.action.type).toBe('attack');
    const { state: after } = applyCommand(state, cmd);
    expect(unitAt(after, 4, 0)).toBeUndefined();
  });

  it('finishes a capture in progress instead of wandering off', () => {
    const state = createGame(
      testMap({
        units: [
          { type: 'infantry', owner: 'red', x: 5, y: 2 },
          // Blue garrisons its HQ so the red infantry can't rush it instead.
          { type: 'infantry', owner: 'blue', x: 6, y: 3 },
        ],
      }),
    );
    const inf = unitAt(state, 5, 2)!;
    const city = tileAt(state, 5, 2);
    city.capturingUnitId = inf.id;
    city.capturePoints = 10;

    const cmd = nextAiCommand(state);
    expect(cmd).toEqual({
      kind: 'move',
      unitId: inf.id,
      to: { x: 5, y: 2 },
      action: { type: 'capture' },
    });
    const { state: after } = applyCommand(state, cmd);
    expect(tileAt(after, 5, 2).owner).toBe('red');
  });

  it('sends idle infantry toward capturable properties', () => {
    const state = createGame(
      testMap({
        units: [
          { type: 'infantry', owner: 'red', x: 3, y: 4 },
          { type: 'infantry', owner: 'blue', x: 0, y: 0 },
        ],
      }),
    );
    const inf = unitAt(state, 3, 4)!;
    const cmd = nextAiCommand(state);
    expect(cmd.kind).toBe('move');
    if (cmd.kind !== 'move') return;
    expect(cmd.unitId).toBe(inf.id);
    // Nearest capturable is the neutral city at (5,2): the move must close in.
    const before = Math.abs(inf.x - 5) + Math.abs(inf.y - 2);
    const afterDist = Math.abs(cmd.to.x - 5) + Math.abs(cmd.to.y - 2);
    expect(afterDist).toBeLessThan(before);
  });

  it('builds with available funds, then ends the turn', () => {
    let state = createGame(
      testMap({
        startingFunds: 7000,
        units: [{ type: 'infantry', owner: 'blue', x: 6, y: 4 }],
      }),
    );
    // Red has no units to move, so the AI should go straight to building.
    const cmd = nextAiCommand(state);
    expect(cmd.kind).toBe('build');
    state = applyCommand(state, cmd).state;
    // Factory now occupied and funds spent: nothing left but ending the turn.
    expect(nextAiCommand(state)).toEqual({ kind: 'endTurn' });
  });

  it('plays a full legal AI-vs-AI game on the real map without stalling', () => {
    let state: GameState = createGame(CROSSFIRE_VALLEY);
    let steps = 0;
    const unitsSeen = new Set<number>();

    while (!state.winner && state.day <= 20 && steps < 4000) {
      const cmd = nextAiCommand(state);
      // applyCommand throws on any illegal command — that's the assertion.
      state = applyCommand(state, cmd).state;
      for (const u of state.units) unitsSeen.add(u.id);
      steps += 1;
    }

    expect(steps).toBeLessThan(4000);
    // The game actually went somewhere: units were built beyond the initial 10
    // and combat/economy ran for multiple days or someone won.
    expect(unitsSeen.size).toBeGreaterThan(10);
    expect(state.winner !== null || state.day > 5).toBe(true);
  });

  it('AI-vs-AI reaches a decisive result on a tiny duel map', () => {
    let state = createGame(
      testMap({
        startingFunds: 20000,
        units: [
          { type: 'lightTank', owner: 'red', x: 2, y: 0 },
          { type: 'infantry', owner: 'red', x: 2, y: 3 },
          { type: 'lightTank', owner: 'blue', x: 5, y: 4 },
          { type: 'infantry', owner: 'blue', x: 5, y: 3 },
        ],
      }),
    );
    let steps = 0;
    while (!state.winner && steps < 2000) {
      state = applyCommand(state, nextAiCommand(state)).state;
      steps += 1;
    }
    expect(state.winner).not.toBeNull();
  });
});
