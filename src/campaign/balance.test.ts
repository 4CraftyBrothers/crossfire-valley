import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { applyCommand } from '../engine/game';
import { createGame, propertiesOwned } from '../engine/state';
import { MISSIONS } from './missions';

/**
 * Not a pass/fail balance check — a report. Plays every mission with a
 * hard AI as Red against the mission's own difficulty as Blue and prints
 * how it went. A mission the red AI wins on day 3 is probably too easy for
 * a person; one it can't win in 40 days deserves a look.
 */
describe('campaign balance report', () => {
  it('plays every mission AI-vs-AI and prints the outcome', () => {
    const play = (m: (typeof MISSIONS)[number], redStyle: 'hard' | 'turtle') => {
      let state = createGame(m.map, { fog: m.fog, objective: m.objective });
      let steps = 0;
      while (!state.winner && state.day <= 40 && steps < 30000) {
        const cmd =
          state.current === 'red' && redStyle === 'turtle'
            ? ({ kind: 'endTurn' } as const)
            : nextAiCommand(state, state.current === 'red' ? 'hard' : m.difficulty);
        state = applyCommand(state, cmd).state;
        steps += 1;
      }
      return state;
    };

    const rows: string[] = [];
    for (const [i, m] of MISSIONS.entries()) {
      const state = play(m, 'hard');
      const red = state.units.filter((u) => u.owner === 'red').length;
      const blue = state.units.filter((u) => u.owner === 'blue').length;
      let line =
        `${String(i + 1).padStart(2)}. ${m.name.padEnd(18)} ${(state.winner ?? 'none').padEnd(5)} day ${String(state.day).padStart(2)}  ` +
        `units R${red}/B${blue}  bldg R${propertiesOwned(state, 'red')}/B${propertiesOwned(state, 'blue')}  ` +
        `funds R$${state.funds.red}/B$${state.funds.blue}  [${m.difficulty}${m.fog ? ', fog' : ''}${m.objective ? `, ${m.objective.kind}` : ''}]`;
      if (m.objective?.kind === 'survive') {
        // A red that never moves still counter-fires and heals on buildings:
        // the floor any human defender should beat.
        const t = play(m, 'turtle');
        line += `  turtle: ${t.winner ?? 'none'} day ${t.day}, R${t.units.filter((u) => u.owner === 'red').length} left`;
      }
      rows.push(line);
    }
    console.log('\n' + rows.join('\n') + '\n');
    expect(rows).toHaveLength(MISSIONS.length);
  });
});
