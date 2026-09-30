import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { applyCommand } from '../engine/game';
import { validateMapDef } from '../engine/serialize';
import { createGame } from '../engine/state';
import { LESSONS } from './bootcamp';

describe('boot camp', () => {
  it('has eight lessons on small valid maps with in-bounds hints', () => {
    expect(LESSONS).toHaveLength(8);
    for (const lesson of LESSONS) {
      expect(validateMapDef(lesson.map), lesson.name).toEqual([]);
      const w = lesson.map.grid[0].length;
      const h = lesson.map.grid.length;
      expect(w * h, lesson.name).toBeLessThanOrEqual(9 * 7);
      const steps = lesson.steps();
      expect(steps.at(-1)!.final, lesson.name).toBe(true);
      for (const step of steps) {
        for (const p of step.highlight ?? []) {
          expect(p.x >= 0 && p.x < w && p.y >= 0 && p.y < h, `${lesson.name} ${p.x},${p.y}`).toBe(true);
        }
      }
    }
  });

  // Blue plays normal here, not the lessons' easy: stronger, and deterministic,
  // so a pass means a real margin rather than a lucky roll.
  it('every lesson is winnable: a hard Red beats a normal Blue quickly', () => {
    for (const lesson of LESSONS) {
      let state = createGame(lesson.map, { fog: lesson.fog, objective: lesson.objective });
      let steps = 0;
      while (!state.winner && state.day <= 20 && steps < 5000) {
        state = applyCommand(state, nextAiCommand(state, state.current === 'red' ? 'hard' : 'normal')).state;
        steps += 1;
      }
      expect(state.winner, `${lesson.name} (day ${state.day})`).toBe('red');
    }
  });
});
