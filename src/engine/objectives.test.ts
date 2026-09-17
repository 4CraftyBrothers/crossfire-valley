import { describe, expect, it } from 'vitest';
import { applyCommand } from './game';
import { createGame, propertiesOwned } from './state';
import type { MapDef } from './types';

const MAP: MapDef = {
  name: 'Objectives',
  grid: ['Hc.cH', '.....'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 4, y: 0, owner: 'blue' },
  ],
  units: [
    { type: 'infantry', owner: 'red', x: 1, y: 1 },
    { type: 'infantry', owner: 'blue', x: 3, y: 1 },
  ],
  startingFunds: 0,
};

describe('campaign objectives', () => {
  it('standard games carry no objective', () => {
    expect(createGame(MAP).objective).toBeUndefined();
  });

  it('survive: red wins when its turn starts on the target day', () => {
    let state = createGame(MAP, { objective: { kind: 'survive', day: 2 } });
    state = applyCommand(state, { kind: 'endTurn' }).state; // blue, day 1
    expect(state.winner).toBeNull();
    const { state: next, events } = applyCommand(state, { kind: 'endTurn' }); // red, day 2
    expect(next.winner).toBe('red');
    expect(events.some((e) => e.type === 'victory' && e.winner === 'red')).toBe(true);
  });

  it('capture: red wins on owning enough buildings', () => {
    let state = createGame(MAP, { objective: { kind: 'capture', count: 2 } });
    const red = state.units.find((u) => u.owner === 'red')!;
    state = applyCommand(state, { kind: 'move', unitId: red.id, to: { x: 1, y: 0 }, action: { type: 'capture' } }).state;
    expect(state.winner).toBeNull(); // capture takes two turns at full health
    state = applyCommand(state, { kind: 'endTurn' }).state;
    state = applyCommand(state, { kind: 'endTurn' }).state;
    const { state: next, events } = applyCommand(state, {
      kind: 'move',
      unitId: red.id,
      to: { x: 1, y: 0 },
      action: { type: 'capture' },
    });
    expect(propertiesOwned(next, 'red')).toBe(2);
    expect(next.winner).toBe('red');
    expect(events.some((e) => e.type === 'victory')).toBe(true);
  });

  it('blue capturing a city never triggers the red objective', () => {
    let state = createGame(MAP, { objective: { kind: 'capture', count: 2 } });
    state = applyCommand(state, { kind: 'endTurn' }).state;
    const blue = state.units.find((u) => u.owner === 'blue')!;
    state = applyCommand(state, { kind: 'move', unitId: blue.id, to: { x: 3, y: 0 }, action: { type: 'capture' } }).state;
    state = applyCommand(state, { kind: 'endTurn' }).state;
    state = applyCommand(state, { kind: 'endTurn' }).state;
    state = applyCommand(state, { kind: 'move', unitId: blue.id, to: { x: 3, y: 0 }, action: { type: 'capture' } }).state;
    expect(propertiesOwned(state, 'blue')).toBe(2);
    expect(state.winner).toBeNull();
  });
});
