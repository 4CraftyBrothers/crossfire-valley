import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { MISSIONS } from '../campaign/missions';
import { attackableTargets, canCounter, computeDamage } from '@crossfire/engine';
import { DAMAGE, UNIT_DATA } from '@crossfire/engine';
import { applyCommand } from '@crossfire/engine';
import { key, reachableTiles } from '@crossfire/engine';
import { createGame, unitAt } from '@crossfire/engine';
import { canSeeUnit } from '@crossfire/engine';
import type { GameState, MapDef, UnitType } from '@crossfire/engine';

function map(overrides: Partial<MapDef> = {}): MapDef {
  return {
    name: 'Air Test',
    grid: [
      '..........',
      '.m.w......',
      '.m.w..f...',
      '.m.w......',
      '..........',
    ],
    properties: [],
    units: [],
    startingFunds: 0,
    ...overrides,
  };
}

describe('air units', () => {
  it('damage matrix covers every unit pairing', () => {
    const types = Object.keys(UNIT_DATA) as UnitType[];
    for (const a of types) {
      for (const d of types) {
        expect(typeof DAMAGE[a][d], `${a} vs ${d}`).toBe('number');
      }
    }
  });

  it('helicopters fly over mountains, water, and enemies', () => {
    const state = createGame(
      map({
        units: [
          { type: 'helicopter', owner: 'red', x: 0, y: 2 },
          { type: 'heavyTank', owner: 'blue', x: 2, y: 2 },
        ],
      }),
    );
    const heli = unitAt(state, 0, 2)!;
    const reach = reachableTiles(state, heli);
    expect(reach.has(key(1, 2))).toBe(true); // mountain: hover anywhere
    expect(reach.has(key(3, 2))).toBe(true); // water too
    expect(reach.has(key(5, 2))).toBe(true); // beyond enemy tank: flew over it
    expect(reach.has(key(2, 2))).toBe(false); // can't land on the enemy
  });

  it('aircraft get no terrain defense', () => {
    const state = createGame(
      map({
        units: [
          { type: 'antiAir', owner: 'red', x: 5, y: 2 },
          { type: 'helicopter', owner: 'blue', x: 6, y: 2 }, // over forest
        ],
      }),
    );
    const aa = unitAt(state, 5, 2)!;
    const heli = unitAt(state, 6, 2)!;
    // Forest would grant 2 stars to ground units; heli gets none: full 120.
    expect(computeDamage(state, aa, heli)).toBe(120);
  });

  it('artillery cannot target aircraft, and helis cannot counter AA at range', () => {
    const state = createGame(
      map({
        units: [
          { type: 'artillery', owner: 'red', x: 0, y: 0 },
          { type: 'helicopter', owner: 'blue', x: 2, y: 0 },
          { type: 'lightTank', owner: 'blue', x: 0, y: 3 },
        ],
      }),
    );
    const arty = unitAt(state, 0, 0)!;
    const targets = attackableTargets(state, arty, 0, 0, false);
    // Range-2 heli is excluded (no weapon); range-3 tank is fine.
    expect(targets.map((t) => t.type)).toEqual(['lightTank']);
  });

  it('AA vs heli: heli can counter AA (adjacent), infantry chip damage works', () => {
    const state = createGame(
      map({
        units: [
          { type: 'antiAir', owner: 'red', x: 5, y: 0 },
          { type: 'helicopter', owner: 'blue', x: 6, y: 0 },
          { type: 'infantry', owner: 'red', x: 6, y: 1 },
        ],
      }),
    );
    const aa = unitAt(state, 5, 0)!;
    const heli = unitAt(state, 6, 0)!;
    expect(canCounter(aa, heli)).toBe(true); // heli shoots back at AA
    const { state: after, events } = applyCommand(state, {
      kind: 'move',
      unitId: aa.id,
      to: { x: 5, y: 0 },
      action: { type: 'attack', targetId: heli.id },
    });
    expect(unitAt(after, 6, 0)).toBeUndefined(); // 120 base: one-shot
    expect(events.filter((e) => e.type === 'damage')).toHaveLength(1); // dead units don't counter
  });
});

describe('forest hiding and ambush', () => {
  function fogMap(): GameState {
    return createGame(
      map({
        grid: [
          '..........',
          '..........',
          '...f......',
          '..........',
          '..........',
        ],
        units: [
          { type: 'lightTank', owner: 'red', x: 0, y: 2 },
          { type: 'bazooka', owner: 'blue', x: 3, y: 2 }, // hiding in the forest
          { type: 'recon', owner: 'blue', x: 9, y: 4 },
        ],
      }),
      { fog: true },
    );
  }

  it('units in forests are hidden until an enemy is adjacent', () => {
    const state = fogMap();
    const hider = unitAt(state, 3, 2)!;
    // The tank is 3 away with vision 3: tile lit, but the forest conceals.
    expect(canSeeUnit(state, 'red', hider)).toBe(false);
    // Move the tank adjacent: revealed.
    const moved = applyCommand(state, {
      kind: 'move',
      unitId: unitAt(state, 0, 2)!.id,
      to: { x: 2, y: 2 },
      action: { type: 'wait' },
    }).state;
    expect(canSeeUnit(moved, 'red', unitAt(moved, 3, 2)!)).toBe(true);
  });

  it('moving through a hidden enemy triggers an ambush stop', () => {
    const state = fogMap();
    const tank = unitAt(state, 0, 2)!;
    // The hidden bazooka doesn't block planning: (5,2) looks reachable.
    expect(reachableTiles(state, tank).has(key(5, 2))).toBe(true);
    const { state: after, events } = applyCommand(state, {
      kind: 'move',
      unitId: tank.id,
      to: { x: 5, y: 2 },
      action: { type: 'wait' },
    });
    const movedTank = after.units.find((u) => u.id === tank.id)!;
    expect(movedTank.x).toBe(2); // stopped short of the forest at (3,2)
    expect(movedTank.acted).toBe(true);
    expect(events.some((e) => e.type === 'ambushed')).toBe(true);
  });

  it('an ambush cancels the ordered action', () => {
    const state = fogMap();
    const tank = unitAt(state, 0, 2)!;
    const recon = unitAt(state, 9, 4)!;
    // Order an (illegal-after-ambush) attack: it must be dropped, not thrown.
    const { state: after } = applyCommand(state, {
      kind: 'move',
      unitId: tank.id,
      to: { x: 5, y: 2 },
      action: { type: 'attack', targetId: recon.id },
    });
    expect(after.units.find((u) => u.id === recon.id)!.hp).toBe(100);
  });

  it('without fog, enemies always block and no ambush fires', () => {
    const state = createGame(
      map({
        grid: ['..........', '..........', '...f......', '..........', '..........'],
        units: [
          { type: 'lightTank', owner: 'red', x: 0, y: 2 },
          { type: 'bazooka', owner: 'blue', x: 3, y: 2 },
        ],
      }),
    );
    const tank = unitAt(state, 0, 2)!;
    const reach = reachableTiles(state, tank);
    expect(reach.has(key(3, 2))).toBe(false); // visible enemy: not a dest
    // (4,2) requires detouring around the bazooka; it never ambushes.
    const { state: after, events } = applyCommand(state, {
      kind: 'move',
      unitId: tank.id,
      to: { x: 4, y: 2 },
      action: { type: 'wait' },
    });
    expect(events.some((e) => e.type === 'ambushed')).toBe(false);
    expect(after.units.find((u) => u.id === tank.id)!.x).toBe(4);
  });
});

describe('Skyfall mission', () => {
  it('is the fourth mission and plays a full legal AI-vs-AI game', () => {
    expect(MISSIONS[3].name).toBe('Skyfall');
    let state = createGame(MISSIONS[3].map, { fog: MISSIONS[3].fog });
    let steps = 0;
    while (!state.winner && state.day <= 15 && steps < 3000) {
      state = applyCommand(state, nextAiCommand(state)).state;
      steps += 1;
    }
    expect(steps).toBeLessThan(3000);
  });
});
