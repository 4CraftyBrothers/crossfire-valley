import { describe, expect, it } from 'vitest';
import { computeDamage } from './combat';
import { CAPTURE_POINTS, UNIT_DATA } from './data';
import { applyCommand, canBuildAt, canCaptureAt } from './game';
import { key, reachableTiles } from './movement';
import { createGame, tileAt, unitAt, unitById } from './state';
import type { GameState, MapDef, PlayerId, UnitType } from './types';

/** Small open test map: 7x5, all plains except labelled tiles. */
function testMap(overrides: Partial<MapDef> = {}): MapDef {
  return {
    name: 'Test',
    grid: [
      '.......',
      '.f.m...',
      '.F.w.c.',
      '.H.....',
      '.......',
    ],
    properties: [
      { x: 1, y: 2, owner: 'red' },
      { x: 1, y: 3, owner: 'red' },
    ],
    units: [],
    startingFunds: 10000,
    ...overrides,
  };
}

function withUnits(units: MapDef['units'], overrides: Partial<MapDef> = {}): GameState {
  return createGame(testMap({ units, ...overrides }));
}

function u(state: GameState, x: number, y: number) {
  const unit = unitAt(state, x, y);
  if (!unit) throw new Error(`No unit at ${x},${y}`);
  return unit;
}

describe('movement', () => {
  it('computes infantry range with terrain costs', () => {
    const state = withUnits([{ type: 'infantry', owner: 'red', x: 0, y: 0 }]);
    const reach = reachableTiles(state, u(state, 0, 0));
    expect(reach.has(key(3, 0))).toBe(true); // 3 plains
    expect(reach.has(key(4, 0))).toBe(false); // out of budget
    expect(reach.has(key(1, 1))).toBe(true); // forest costs 1 for foot
    expect(reach.has(key(3, 1))).toBe(false); // mountain: cheapest path is 3 plains + 2 = 5 > 3
  });

  it('mountains cost 2 for infantry and block treads', () => {
    const state = withUnits([
      { type: 'infantry', owner: 'red', x: 3, y: 0 },
      { type: 'lightTank', owner: 'blue', x: 2, y: 1 },
    ]);
    const inf = reachableTiles(state, u(state, 3, 0));
    // mountain at (3,1): adjacent, costs 2 of 3 movement
    expect(inf.has(key(3, 1))).toBe(true);
    const tank = reachableTiles(state, u(state, 2, 1));
    expect(tank.has(key(3, 1))).toBe(false); // mountain impassable
    expect(tank.has(key(3, 2))).toBe(false); // water impassable
  });

  it('enemies block pathing, friends can be passed but not stopped on', () => {
    const state = withUnits([
      { type: 'infantry', owner: 'red', x: 0, y: 4 },
      { type: 'infantry', owner: 'red', x: 1, y: 4 },
      { type: 'infantry', owner: 'blue', x: 2, y: 4 },
    ]);
    const reach = reachableTiles(state, u(state, 0, 4));
    expect(reach.has(key(1, 4))).toBe(false); // friend occupies
    expect(reach.has(key(2, 4))).toBe(false); // enemy occupies
    // Can route around the friend but the enemy blocks the direct lane;
    // going via row 3 is open.
    expect(reach.has(key(2, 3))).toBe(true);
  });

  it('unit can stay in place', () => {
    const state = withUnits([{ type: 'infantry', owner: 'red', x: 0, y: 0 }]);
    const reach = reachableTiles(state, u(state, 0, 0));
    expect(reach.has(key(0, 0))).toBe(true);
  });
});

describe('combat', () => {
  it('computes Advance Wars-style damage', () => {
    const state = withUnits([
      { type: 'lightTank', owner: 'red', x: 0, y: 0 },
      { type: 'infantry', owner: 'blue', x: 1, y: 0 },
    ]);
    // 75 base * 1.0 attacker * (100 - 1 star * 10 hp)/100 = 67.5 -> 68
    expect(computeDamage(state, u(state, 0, 0), u(state, 1, 0))).toBe(68);
  });

  it('applies counterattacks from survivors', () => {
    const state = withUnits([
      { type: 'lightTank', owner: 'red', x: 0, y: 0 },
      { type: 'infantry', owner: 'blue', x: 1, y: 0 },
    ]);
    const attacker = u(state, 0, 0);
    const target = u(state, 1, 0);
    const { state: after, events } = applyCommand(state, {
      kind: 'move',
      unitId: attacker.id,
      to: { x: 0, y: 0 },
      action: { type: 'attack', targetId: target.id },
    });
    const damageEvents = events.filter((e) => e.type === 'damage');
    expect(damageEvents).toHaveLength(2); // attack + counter
    expect(unitById(after, target.id)!.hp).toBe(32);
    // counter: 5 base * 0.32 * (100 - 1*10)/100 = 1.44 -> 1
    expect(unitById(after, attacker.id)!.hp).toBe(99);
    expect(unitById(after, attacker.id)!.acted).toBe(true);
  });

  it('artillery cannot fire after moving, cannot be countered, min range 2', () => {
    const state = withUnits([
      { type: 'artillery', owner: 'red', x: 0, y: 0 },
      { type: 'lightTank', owner: 'blue', x: 2, y: 0 },
      { type: 'infantry', owner: 'blue', x: 1, y: 0 },
    ]);
    const arty = u(state, 0, 0);
    const tank = u(state, 2, 0);
    const adjacentInf = u(state, 1, 0);

    // Adjacent enemy is inside min range — not attackable.
    expect(() =>
      applyCommand(state, {
        kind: 'move',
        unitId: arty.id,
        to: { x: 0, y: 0 },
        action: { type: 'attack', targetId: adjacentInf.id },
      }),
    ).toThrow();

    // Standing still: can hit range-2 tank, takes no counter.
    const { state: after, events } = applyCommand(state, {
      kind: 'move',
      unitId: arty.id,
      to: { x: 0, y: 0 },
      action: { type: 'attack', targetId: tank.id },
    });
    expect(events.filter((e) => e.type === 'damage')).toHaveLength(1);
    expect(unitById(after, arty.id)!.hp).toBe(100);
    expect(unitById(after, tank.id)!.hp).toBeLessThan(100);

    // Moving then firing is illegal for indirect units.
    expect(() =>
      applyCommand(state, {
        kind: 'move',
        unitId: arty.id,
        to: { x: 0, y: 1 },
        action: { type: 'attack', targetId: tank.id },
      }),
    ).toThrow();
  });

  it('destroys units at 0 hp and detects rout victory', () => {
    const state = withUnits([
      { type: 'heavyTank', owner: 'red', x: 0, y: 0 },
      { type: 'infantry', owner: 'blue', x: 1, y: 0 },
    ]);
    // Heavy tank vs infantry on plains: 105 * (100-10)/100 = 94.5 -> 95... not lethal.
    // Weaken the infantry first by replaying the attack across turns.
    let s = state;
    for (let i = 0; i < 3 && !s.winner; i++) {
      const tank = s.units.find((x) => x.type === 'heavyTank')!;
      const inf = s.units.find((x) => x.type === 'infantry');
      if (!inf) break;
      s = applyCommand(s, {
        kind: 'move',
        unitId: tank.id,
        to: { x: tank.x, y: tank.y },
        action: { type: 'attack', targetId: inf.id },
      }).state;
      if (!s.winner) {
        s = applyCommand(s, { kind: 'endTurn' }).state; // blue
        s = applyCommand(s, { kind: 'endTurn' }).state; // back to red
      }
    }
    expect(s.units.filter((x) => x.owner === 'blue')).toHaveLength(0);
    expect(s.winner).toBe('red');
  });
});

describe('capture and economy', () => {
  it('captures a neutral city over two turns and resets when leaving', () => {
    let state = withUnits([{ type: 'infantry', owner: 'red', x: 5, y: 2 }]);
    const inf = u(state, 5, 2);
    expect(canCaptureAt(state, inf, 5, 2)).toBe(true);

    // Full-health infantry: 10 capture points per turn, city needs 20.
    let result = applyCommand(state, {
      kind: 'move',
      unitId: inf.id,
      to: { x: 5, y: 2 },
      action: { type: 'capture' },
    });
    state = result.state;
    expect(tileAt(state, 5, 2).capturePoints).toBe(CAPTURE_POINTS - 10);
    expect(tileAt(state, 5, 2).owner).toBeNull();

    state = applyCommand(state, { kind: 'endTurn' }).state;
    state = applyCommand(state, { kind: 'endTurn' }).state;

    result = applyCommand(state, {
      kind: 'move',
      unitId: inf.id,
      to: { x: 5, y: 2 },
      action: { type: 'capture' },
    });
    state = result.state;
    expect(tileAt(state, 5, 2).owner).toBe('red');
    expect(result.events.some((e) => e.type === 'captured')).toBe(true);
  });

  it('resets capture progress if the unit moves away', () => {
    let state = withUnits([{ type: 'infantry', owner: 'red', x: 5, y: 2 }]);
    const inf = u(state, 5, 2);
    state = applyCommand(state, {
      kind: 'move',
      unitId: inf.id,
      to: { x: 5, y: 2 },
      action: { type: 'capture' },
    }).state;
    state = applyCommand(state, { kind: 'endTurn' }).state;
    state = applyCommand(state, { kind: 'endTurn' }).state;
    // Walk off, then the tile's progress resets.
    state = applyCommand(state, {
      kind: 'move',
      unitId: inf.id,
      to: { x: 5, y: 1 },
      action: { type: 'wait' },
    }).state;
    expect(tileAt(state, 5, 2).capturePoints).toBe(CAPTURE_POINTS);
    expect(tileAt(state, 5, 2).capturingUnitId).toBeNull();
  });

  it('capturing the enemy HQ wins the game', () => {
    let state = withUnits([{ type: 'bazooka', owner: 'blue', x: 1, y: 3 }]);
    state = applyCommand(state, { kind: 'endTurn' }).state; // to blue
    const baz = u(state, 1, 3);
    state = applyCommand(state, {
      kind: 'move',
      unitId: baz.id,
      to: { x: 1, y: 3 },
      action: { type: 'capture' },
    }).state;
    state = applyCommand(state, { kind: 'endTurn' }).state;
    state = applyCommand(state, { kind: 'endTurn' }).state;
    const result = applyCommand(state, {
      kind: 'move',
      unitId: baz.id,
      to: { x: 1, y: 3 },
      action: { type: 'capture' },
    });
    expect(result.state.winner).toBe('blue');
    expect(result.events.some((e) => e.type === 'victory')).toBe(true);
  });

  it('pays income per property at turn start and red gets day-1 income', () => {
    const state = withUnits([]);
    // Red owns factory + HQ = 2 properties: 10000 start + 2000 day-1 income.
    expect(state.funds.red).toBe(12000);
    const { state: s2, events } = applyCommand(state, { kind: 'endTurn' });
    const turnEvent = events.find((e) => e.type === 'turnStarted');
    expect(turnEvent && turnEvent.type === 'turnStarted' && turnEvent.income).toBe(0);
    expect(s2.funds.blue).toBe(10000); // blue owns nothing
    expect(s2.current).toBe('blue');
    const { state: s3 } = applyCommand(s2, { kind: 'endTurn' });
    expect(s3.current).toBe('red');
    expect(s3.day).toBe(2);
    expect(s3.funds.red).toBe(14000);
  });

  it('builds units that cannot act until next turn, and charges for them', () => {
    let state = withUnits([]);
    expect(canBuildAt(state, 1, 2)).toBe(true);
    const { state: s2, events } = applyCommand(state, {
      kind: 'build',
      at: { x: 1, y: 2 },
      unitType: 'lightTank',
    });
    expect(s2.funds.red).toBe(12000 - UNIT_DATA.lightTank.cost);
    const built = events.find((e) => e.type === 'built');
    expect(built).toBeDefined();
    const tank = unitAt(s2, 1, 2)!;
    expect(tank.acted).toBe(true);
    expect(canBuildAt(s2, 1, 2)).toBe(false); // occupied now

    // Illegal: building on an occupied factory or without funds.
    expect(() =>
      applyCommand(s2, { kind: 'build', at: { x: 1, y: 2 }, unitType: 'infantry' }),
    ).toThrow();

    // After a full round the tank can move.
    let s3 = applyCommand(s2, { kind: 'endTurn' }).state;
    s3 = applyCommand(s3, { kind: 'endTurn' }).state;
    expect(unitById(s3, tank.id)!.acted).toBe(false);
  });

  it('repairs units standing on owned properties at turn start', () => {
    let state = withUnits([{ type: 'infantry', owner: 'red', x: 1, y: 2 }]);
    const inf = u(state, 1, 2);
    unitById(state, inf.id)!.hp = 50;
    state = applyCommand(state, { kind: 'endTurn' }).state;
    state = applyCommand(state, { kind: 'endTurn' }).state;
    expect(unitById(state, inf.id)!.hp).toBe(70);
  });
});

describe('turn rules', () => {
  it('rejects acting twice, acting out of turn, and acting after game over', () => {
    let state = withUnits([
      { type: 'infantry', owner: 'red', x: 0, y: 0 },
      { type: 'infantry', owner: 'blue', x: 6, y: 4 },
    ]);
    const red = u(state, 0, 0);
    const blue = u(state, 6, 4);

    expect(() =>
      applyCommand(state, { kind: 'move', unitId: blue.id, to: { x: 6, y: 3 }, action: { type: 'wait' } }),
    ).toThrow(/Not your unit/);

    state = applyCommand(state, {
      kind: 'move',
      unitId: red.id,
      to: { x: 1, y: 0 },
      action: { type: 'wait' },
    }).state;
    expect(() =>
      applyCommand(state, { kind: 'move', unitId: red.id, to: { x: 2, y: 0 }, action: { type: 'wait' } }),
    ).toThrow(/already acted/);

    const over: GameState = { ...state, winner: 'red' as PlayerId };
    expect(() => applyCommand(over, { kind: 'endTurn' })).toThrow(/Game is over/);
  });

  it('cannot build unit types at enemy or neutral factories', () => {
    let state = withUnits([]);
    state = applyCommand(state, { kind: 'endTurn' }).state; // blue's turn
    expect(canBuildAt(state, 1, 2)).toBe(false);
    expect(() =>
      applyCommand(state, { kind: 'build', at: { x: 1, y: 2 }, unitType: 'infantry' as UnitType }),
    ).toThrow(/Not your factory/);
  });
});
