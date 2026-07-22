import { describe, expect, it } from 'vitest';
import { createGame, unitAt } from '@crossfire/engine';
import type { Command, MapDef } from '@crossfire/engine';
import { validateCommand } from './validate';

// A tiny map is enough: the point of this test is that the SERVER, importing
// the shared @crossfire/engine, accepts a legal move and rejects an illegal
// one exactly as the client would — proving both run identical rules.
const MAP: MapDef = {
  name: 'Validation Fixture',
  grid: ['.....', '.....', '.....'],
  properties: [],
  units: [
    { type: 'infantry', owner: 'red', x: 1, y: 1 },
    { type: 'infantry', owner: 'blue', x: 3, y: 1 },
  ],
  startingFunds: 0,
};

describe('validateCommand (server-as-referee)', () => {
  it('accepts a legal move and returns the server-computed next state', () => {
    const state = createGame(MAP);
    const redInfantry = unitAt(state, 1, 1)!;

    const command: Command = {
      kind: 'move',
      unitId: redInfantry.id,
      to: { x: 1, y: 2 },
      action: { type: 'wait' },
    };

    const result = validateCommand(state, command);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The server re-derived the outcome from scratch; the unit is now at (1,2).
    expect(unitAt(result.state, 1, 2)?.id).toBe(redInfantry.id);
    expect(unitAt(result.state, 1, 1)).toBeUndefined();
  });

  it('rejects an illegal move with the engine reason and no state', () => {
    const state = createGame(MAP);
    const redInfantry = unitAt(state, 1, 1)!;

    const command: Command = {
      kind: 'move',
      unitId: redInfantry.id,
      to: { x: 4, y: 4 }, // off the board — unreachable
      action: { type: 'wait' },
    };

    const result = validateCommand(state, command);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/reachable/i);
  });

  it("rejects moving an opponent's unit", () => {
    const state = createGame(MAP); // red to move
    const blueInfantry = unitAt(state, 3, 1)!;

    const command: Command = {
      kind: 'move',
      unitId: blueInfantry.id,
      to: { x: 3, y: 2 },
      action: { type: 'wait' },
    };

    const result = validateCommand(state, command);

    expect(result.ok).toBe(false);
  });
});
