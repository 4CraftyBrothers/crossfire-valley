import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { CROSSFIRE_VALLEY } from '../maps';
import { attackableTargets } from '@crossfire/engine';
import { applyCommand } from '@crossfire/engine';
import { decodeMatch, encodeMatch } from '@crossfire/engine';
import { createGame, unitAt } from '@crossfire/engine';
import { isVisible, visibleTiles } from '@crossfire/engine';
import type { GameState, MapDef } from '@crossfire/engine';

function openMap(overrides: Partial<MapDef> = {}): MapDef {
  return {
    name: 'Fog Test',
    grid: [
      '..........',
      '.m........',
      '..........',
      '..........',
      '..........',
    ],
    properties: [],
    units: [],
    startingFunds: 0,
    ...overrides,
  };
}

function fogGame(overrides: Partial<MapDef> = {}): GameState {
  return createGame(openMap(overrides), { fog: true });
}

describe('vision', () => {
  it('gives units a manhattan sight disc, bigger for recon', () => {
    const state = fogGame({
      units: [
        { type: 'infantry', owner: 'red', x: 5, y: 2 },
        { type: 'recon', owner: 'blue', x: 5, y: 2 },
      ],
    });
    // Infantry vision 2 from (5,2)
    expect(isVisible(state, 'red', 7, 2)).toBe(true);
    expect(isVisible(state, 'red', 8, 2)).toBe(false);
    expect(isVisible(state, 'red', 6, 3)).toBe(true); // dist 2 diagonal-ish
    // Recon vision 5
    expect(isVisible(state, 'blue', 9, 3)).toBe(true); // dist 5
  });

  it('boosts foot vision on mountains and reveals around owned properties', () => {
    const grid = openMap();
    grid.grid[2] = '.c........'; // city at (1,2)
    const state = createGame(
      { ...grid, properties: [{ x: 1, y: 2, owner: 'red' }], units: [{ type: 'infantry', owner: 'red', x: 1, y: 1 }] },
      { fog: true },
    );
    // Infantry on mountain (1,1): vision 2 + 2 = 4.
    expect(isVisible(state, 'red', 5, 1)).toBe(true);
    expect(isVisible(state, 'red', 6, 1)).toBe(false);
    // Property vision 2 around (1,2) contributes too (covered above anyway).
    const vis = visibleTiles(state, 'red');
    expect(vis.has(2 * 10 + 3)).toBe(true); // (3,2) dist 2 from city
  });

  it('hides targets outside vision from attacks, spotters reveal them', () => {
    const state = fogGame({
      units: [
        { type: 'artillery', owner: 'red', x: 0, y: 0 },
        { type: 'heavyTank', owner: 'blue', x: 3, y: 0 }, // range 3, vision 2: unseen
        { type: 'infantry', owner: 'blue', x: 9, y: 4 },
      ],
    });
    const arty = unitAt(state, 0, 0)!;
    const tank = unitAt(state, 3, 0)!;

    // Artillery alone: target in range but out of sight -> not attackable.
    expect(attackableTargets(state, arty, 0, 0, false).map((u) => u.id)).toEqual([]);
    expect(() =>
      applyCommand(state, {
        kind: 'move',
        unitId: arty.id,
        to: { x: 0, y: 0 },
        action: { type: 'attack', targetId: tank.id },
      }),
    ).toThrow(/not in range/);

    // Add a red spotter next to the tank: now the artillery can fire.
    const spotted = fogGame({
      units: [
        { type: 'artillery', owner: 'red', x: 0, y: 0 },
        { type: 'heavyTank', owner: 'blue', x: 3, y: 0 },
        { type: 'infantry', owner: 'red', x: 4, y: 0 },
        { type: 'infantry', owner: 'blue', x: 9, y: 4 },
      ],
    });
    const arty2 = unitAt(spotted, 0, 0)!;
    const tank2 = unitAt(spotted, 3, 0)!;
    expect(attackableTargets(spotted, arty2, 0, 0, false).map((u) => u.id)).toEqual([tank2.id]);
    const { state: after } = applyCommand(spotted, {
      kind: 'move',
      unitId: arty2.id,
      to: { x: 0, y: 0 },
      action: { type: 'attack', targetId: tank2.id },
    });
    expect(unitAt(after, 3, 0)!.hp).toBeLessThan(100);
  });

  it('without fog everything is attackable as before', () => {
    const state = createGame(
      openMap({
        units: [
          { type: 'artillery', owner: 'red', x: 0, y: 0 },
          { type: 'heavyTank', owner: 'blue', x: 3, y: 0 },
        ],
      }),
    );
    const arty = unitAt(state, 0, 0)!;
    expect(state.fog).toBe(false);
    expect(attackableTargets(state, arty, 0, 0, false)).toHaveLength(1);
  });

  it('fog survives the PvP link round-trip', async () => {
    const state = createGame(CROSSFIRE_VALLEY, { fog: true });
    const payload = await decodeMatch(await encodeMatch(state, [{ kind: 'endTurn' }]));
    expect(payload.startState.fog).toBe(true);
  });

  it('AI-vs-AI under fog plays a full legal game', () => {
    let state = createGame(CROSSFIRE_VALLEY, { fog: true });
    let steps = 0;
    while (!state.winner && state.day <= 20 && steps < 4000) {
      state = applyCommand(state, nextAiCommand(state)).state;
      steps += 1;
    }
    expect(steps).toBeLessThan(4000);
    expect(state.winner !== null || state.day > 5).toBe(true);
  });
});
