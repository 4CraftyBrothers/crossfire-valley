import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { CROSSFIRE_VALLEY } from '../maps';
import { applyCommand } from './game';
import { decodeMatch, encodeMatch } from './serialize';
import { createGame } from './state';
import type { Command, GameState } from './types';

/** Let the AI generate a realistic full turn of commands. */
function playOneTurn(state: GameState): { commands: Command[]; final: GameState } {
  const commands: Command[] = [];
  const player = state.current;
  let s = state;
  while (!s.winner && s.current === player) {
    const cmd = nextAiCommand(s);
    commands.push(cmd);
    s = applyCommand(s, cmd).state;
  }
  return { commands, final: s };
}

describe('match serialization', () => {
  it('round-trips a fresh game through encode/decode', async () => {
    const state = createGame(CROSSFIRE_VALLEY);
    const code = await encodeMatch(state, [{ kind: 'endTurn' }]);
    expect(code).toMatch(/^[dr][A-Za-z0-9_-]+$/); // URL-safe, no padding
    const payload = await decodeMatch(code);
    expect(payload.v).toBe(1);
    expect(payload.startState).toEqual(state);
    expect(payload.commands).toEqual([{ kind: 'endTurn' }]);
  });

  it('replaying decoded commands reproduces the sender state exactly', async () => {
    const start = createGame(CROSSFIRE_VALLEY);
    const { commands, final } = playOneTurn(start);
    const code = await encodeMatch(start, commands);

    const payload = await decodeMatch(code);
    let replayed = payload.startState;
    for (const cmd of payload.commands) {
      replayed = applyCommand(replayed, cmd).state;
    }
    expect(replayed).toEqual(final);
    expect(replayed.current).toBe('blue');
  });

  it('produces link-sized codes even for busy turns', async () => {
    // Advance a few full rounds so the board has builds and damage.
    let s = createGame(CROSSFIRE_VALLEY);
    for (let i = 0; i < 6; i++) s = playOneTurn(s).final;
    const { commands } = playOneTurn(s);
    const code = await encodeMatch(s, commands);
    expect(code.length).toBeLessThan(4000);
  });

  it('rejects garbage and tampered payloads', async () => {
    await expect(decodeMatch('x123')).rejects.toThrow();
    await expect(decodeMatch('dnotbase64!!!')).rejects.toThrow();
    // Valid encoding of an invalid payload shape:
    const bogus = await encodeMatch({ width: 3 } as GameState, []);
    await expect(decodeMatch(bogus)).rejects.toThrow(/Malformed/);
  });
});
