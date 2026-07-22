import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { applyCommand } from '@crossfire/engine';
import { createGame, tileAt } from '@crossfire/engine';
import type { GameState, PlayerId } from '@crossfire/engine';
import { MISSIONS } from './missions';

function hqOwners(state: GameState): PlayerId[] {
  const owners: PlayerId[] = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = tileAt(state, x, y);
      if (tile.terrain === 'hq' && tile.owner) owners.push(tile.owner);
    }
  }
  return owners;
}

describe('campaign missions', () => {
  it('every mission builds a valid game with both HQs and red forces', () => {
    for (const mission of MISSIONS) {
      const state = createGame(mission.map, { fog: mission.fog });
      const hqs = hqOwners(state);
      expect(hqs, mission.name).toContain('red');
      expect(hqs, mission.name).toContain('blue');
      expect(
        state.units.filter((u) => u.owner === 'red').length,
        `${mission.name} red units`,
      ).toBeGreaterThan(0);
      expect(
        state.units.filter((u) => u.owner === 'blue').length,
        `${mission.name} blue units`,
      ).toBeGreaterThan(0);
      expect(state.fog).toBe(mission.fog);
    }
  });

  it('mission 1 is winnable: an AI-driven red beats blue quickly', () => {
    let state = createGame(MISSIONS[0].map, { fog: MISSIONS[0].fog });
    let steps = 0;
    while (!state.winner && state.day <= 20 && steps < 2000) {
      state = applyCommand(state, nextAiCommand(state)).state;
      steps += 1;
    }
    expect(state.winner).toBe('red');
  });

  it('every mission map supports a full legal AI-vs-AI game', () => {
    for (const mission of MISSIONS) {
      let state = createGame(mission.map, { fog: mission.fog });
      let steps = 0;
      while (!state.winner && state.day <= 15 && steps < 4000) {
        state = applyCommand(state, nextAiCommand(state)).state;
        steps += 1;
      }
      expect(steps, mission.name).toBeLessThan(4000);
    }
  });
});
