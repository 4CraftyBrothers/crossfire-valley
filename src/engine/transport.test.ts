import { describe, expect, it } from 'vitest';
import { applyCommand, canBuildAt, dropTiles } from './game';
import { boardableTransports } from './movement';
import { validateMapDef } from './serialize';
import { createGame, unitById } from './state';
import type { GameState, MapDef } from './types';

// A river of water splits the map: only the Skylift crosses it.
const RIVER: MapDef = {
  name: 'River',
  grid: ['H.....', '......', 'wwwwww', '......', '.....H'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 5, y: 4, owner: 'blue' },
  ],
  units: [
    { type: 'infantry', owner: 'red', x: 1, y: 1 },
    { type: 'skylift', owner: 'red', x: 2, y: 1 },
    { type: 'lightTank', owner: 'red', x: 3, y: 1 },
    { type: 'infantry', owner: 'red', x: 4, y: 1 },
    { type: 'infantry', owner: 'blue', x: 5, y: 3 },
  ],
  startingFunds: 0,
};

const at = (s: GameState, x: number, y: number) => s.units.find((u) => u.x === x && u.y === y)!;
const endRound = (s: GameState) => applyCommand(applyCommand(s, { kind: 'endTurn' }).state, { kind: 'endTurn' }).state;

describe('skylift', () => {
  it('carries a soldier over water and sets it down next to its landing tile', () => {
    let s = createGame(RIVER);
    const inf = at(s, 1, 1);
    const lift = at(s, 2, 1);
    expect(boardableTransports(s, inf).map((t) => t.id)).toEqual([lift.id]);

    let r = applyCommand(s, { kind: 'move', unitId: inf.id, to: { x: 2, y: 1 }, action: { type: 'load' } });
    expect(r.events.some((e) => e.type === 'loaded')).toBe(true);
    expect(unitById(r.state, inf.id)).toBeUndefined();
    expect(unitById(r.state, lift.id)!.cargo!.map((c) => c.id)).toEqual([inf.id]);

    // Hover over the river and drop the soldier on the far bank.
    s = r.state;
    expect(dropTiles(s, unitById(s, lift.id)!, unitById(s, lift.id)!.cargo![0], 2, 2).map((p) => `${p.x},${p.y}`)).toEqual(['2,3', '2,1']);
    r = applyCommand(s, {
      kind: 'move',
      unitId: lift.id,
      to: { x: 2, y: 2 },
      action: { type: 'unload', drops: [{ unitId: inf.id, at: { x: 2, y: 3 } }] },
    });
    expect(r.events.some((e) => e.type === 'unloaded')).toBe(true);
    expect(unitById(r.state, inf.id)).toMatchObject({ x: 2, y: 3, acted: true });
    expect(unitById(r.state, lift.id)!.cargo).toBeUndefined();

    // Next turn the soldier walks on as normal.
    s = endRound(r.state);
    expect(unitById(s, inf.id)!.acted).toBe(false);
  });

  it('carries only one foot soldier, and nothing else', () => {
    const s = createGame(RIVER);
    const tank = at(s, 3, 1);
    expect(() => applyCommand(s, { kind: 'move', unitId: tank.id, to: { x: 2, y: 1 }, action: { type: 'load' } })).toThrow(
      /Cannot board/,
    );
    const r = applyCommand(s, { kind: 'move', unitId: at(s, 1, 1).id, to: { x: 2, y: 1 }, action: { type: 'load' } });
    const second = at(r.state, 4, 1);
    expect(boardableTransports(r.state, second)).toEqual([]);
    expect(() =>
      applyCommand(r.state, { kind: 'move', unitId: second.id, to: { x: 2, y: 1 }, action: { type: 'load' } }),
    ).toThrow(/Cannot board/);
  });

  it('refuses drops into water, far away, or onto another unit', () => {
    const s0 = createGame(RIVER);
    const inf = at(s0, 1, 1);
    const lift = at(s0, 2, 1);
    const s = applyCommand(s0, { kind: 'move', unitId: inf.id, to: { x: 2, y: 1 }, action: { type: 'load' } }).state;
    const unload = (to: { x: number; y: number }, drop: { x: number; y: number }) =>
      applyCommand(s, { kind: 'move', unitId: lift.id, to, action: { type: 'unload', drops: [{ unitId: inf.id, at: drop }] } });
    expect(() => unload({ x: 2, y: 1 }, { x: 2, y: 2 })).toThrow(/cannot stand/);
    expect(() => unload({ x: 2, y: 1 }, { x: 2, y: 3 })).toThrow(/next to the transport/);
    expect(() => unload({ x: 2, y: 1 }, { x: 3, y: 1 })).toThrow(/occupied/);
  });

  it('takes its passenger down with it', () => {
    let s = createGame({
      ...RIVER,
      units: [
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'skylift', owner: 'red', x: 2, y: 1 },
        { type: 'antiAir', owner: 'blue', x: 3, y: 0 },
        { type: 'infantry', owner: 'blue', x: 5, y: 3 },
      ],
    });
    const inf = at(s, 1, 1);
    const lift = at(s, 2, 1);
    s = applyCommand(s, { kind: 'move', unitId: inf.id, to: { x: 2, y: 1 }, action: { type: 'load' } }).state;
    s = applyCommand(s, { kind: 'endTurn' }).state; // Blue
    const aa = at(s, 3, 0);
    s = applyCommand(s, { kind: 'move', unitId: aa.id, to: { x: 2, y: 0 }, action: { type: 'attack', targetId: lift.id } }).state;
    expect(unitById(s, lift.id)).toBeUndefined();
    expect(JSON.stringify(s.units)).not.toContain(`"id":${inf.id},`);
  });
});

describe('barge', () => {
  // Shore columns on both sides of a channel.
  const CHANNEL: MapDef = {
    name: 'Channel',
    grid: ['H......', '..swws.', '..swws.', '..swws.', '......H'],
    properties: [
      { x: 0, y: 0, owner: 'red' },
      { x: 6, y: 4, owner: 'blue' },
    ],
    units: [
      { type: 'lightTank', owner: 'red', x: 1, y: 2 },
      { type: 'infantry', owner: 'red', x: 1, y: 1 },
      { type: 'barge', owner: 'red', x: 2, y: 2 },
      { type: 'infantry', owner: 'blue', x: 6, y: 0 },
    ],
    startingFunds: 0,
  };

  it('loads two ground units on the shore, crosses, and lands them', () => {
    expect(validateMapDef(CHANNEL)).toEqual([]);
    let s = createGame(CHANNEL);
    const tank = at(s, 1, 2);
    const inf = at(s, 1, 1);
    const barge = at(s, 2, 2);
    s = applyCommand(s, { kind: 'move', unitId: tank.id, to: { x: 2, y: 2 }, action: { type: 'load' } }).state;
    s = applyCommand(s, { kind: 'move', unitId: inf.id, to: { x: 2, y: 2 }, action: { type: 'load' } }).state;
    expect(unitById(s, barge.id)!.cargo).toHaveLength(2);

    const r = applyCommand(s, {
      kind: 'move',
      unitId: barge.id,
      to: { x: 5, y: 2 },
      action: {
        type: 'unload',
        drops: [
          { unitId: tank.id, at: { x: 6, y: 2 } },
          { unitId: inf.id, at: { x: 5, y: 1 } },
        ],
      },
    });
    expect(unitById(r.state, tank.id)).toMatchObject({ x: 6, y: 2 });
    expect(unitById(r.state, inf.id)).toMatchObject({ x: 5, y: 1 });
    expect(r.events.filter((e) => e.type === 'unloaded')).toHaveLength(2);
  });

  it('cannot sail onto land or into a tile with no water route', () => {
    const s = createGame(CHANNEL);
    const barge = at(s, 2, 2);
    expect(() => applyCommand(s, { kind: 'move', unitId: barge.id, to: { x: 1, y: 3 }, action: { type: 'wait' } })).toThrow(
      /not reachable/,
    );
  });
});

describe('build sites', () => {
  const BASES: MapDef = {
    name: 'Bases',
    grid: ['HFA...', '.....s', '....sP', '......', '.....H'],
    properties: [
      { x: 0, y: 0, owner: 'red' },
      { x: 1, y: 0, owner: 'red' },
      { x: 2, y: 0, owner: 'red' },
      { x: 5, y: 2, owner: 'red' },
      { x: 5, y: 4, owner: 'blue' },
    ],
    units: [
      { type: 'infantry', owner: 'red', x: 0, y: 1 },
      { type: 'infantry', owner: 'blue', x: 4, y: 4 },
    ],
    startingFunds: 30000,
  };

  it('builds transports only at their own building', () => {
    const s = createGame(BASES);
    expect(canBuildAt(s, 2, 0)).toBe(true);
    expect(canBuildAt(s, 5, 2)).toBe(true);
    expect(() => applyCommand(s, { kind: 'build', at: { x: 1, y: 0 }, unitType: 'skylift' })).toThrow(/Cannot build that here/);
    expect(() => applyCommand(s, { kind: 'build', at: { x: 2, y: 0 }, unitType: 'lightTank' })).toThrow(/Cannot build that here/);
    expect(applyCommand(s, { kind: 'build', at: { x: 2, y: 0 }, unitType: 'skylift' }).state.units.some((u) => u.type === 'skylift')).toBe(
      true,
    );
    expect(applyCommand(s, { kind: 'build', at: { x: 5, y: 2 }, unitType: 'barge' }).state.units.some((u) => u.type === 'barge')).toBe(
      true,
    );
  });
});

describe('AI transport use', () => {
  it('ferries a stranded soldier across the water and takes the HQ', async () => {
    const { nextAiCommand } = await import('../ai/ai');
    // Red's only soldier is cut off by a channel; the Skylift is its only way over.
    let s = createGame({
      name: 'Island hop',
      grid: ['H..w...', '...w...', '...w...', '...w...', '...w..H'],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 6, y: 4, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'skylift', owner: 'red', x: 1, y: 3 },
        // Blue is unarmed here, so the test measures ferrying, not fighting.
        { type: 'skylift', owner: 'blue', x: 6, y: 0 },
      ],
      startingFunds: 0,
    });
    let loaded = false;
    let steps = 0;
    while (!s.winner && s.day <= 15 && steps < 2000) {
      const r = applyCommand(s, nextAiCommand(s, s.current === 'red' ? 'normal' : 'easy'));
      if (r.events.some((e) => e.type === 'loaded')) loaded = true;
      s = r.state;
      steps += 1;
    }
    expect(loaded).toBe(true);
    expect(s.winner).toBe('red');
  });
});
