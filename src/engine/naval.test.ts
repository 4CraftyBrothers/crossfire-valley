import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { attackableTargets } from './combat';
import { applyCommand, canCaptureAt } from './game';
import { key, reachableTiles } from './movement';
import { validateMapDef } from './serialize';
import { createGame, tileAt } from './state';
import type { GameState, MapDef } from './types';

// Land on both sides of a strait with an oil rig, shallows, and a port.
const STRAIT: MapDef = {
  name: 'Strait',
  grid: ['H.swwws..', '..swOws..', '..Pwxws..', '..swwws..', '..swwws.H'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 2, y: 2, owner: 'red' },
    { x: 8, y: 4, owner: 'blue' },
  ],
  units: [
    { type: 'cutter', owner: 'red', x: 3, y: 2 },
    { type: 'infantry', owner: 'red', x: 0, y: 1 },
    { type: 'infantry', owner: 'blue', x: 7, y: 2 },
  ],
  startingFunds: 0,
};

const at = (s: GameState, x: number, y: number) => s.units.find((u) => u.x === x && u.y === y)!;

describe('ships', () => {
  it('a Cutter captures an oil rig; land units capture ports, ships do not', () => {
    expect(validateMapDef(STRAIT)).toEqual([]);
    let s = createGame(STRAIT);
    const cutter = at(s, 3, 2);
    expect(canCaptureAt(s, cutter, 4, 1)).toBe(true);
    expect(canCaptureAt(s, at(s, 0, 1), 4, 1)).toBe(false);
    s = applyCommand(s, { kind: 'move', unitId: cutter.id, to: { x: 4, y: 1 }, action: { type: 'capture' } }).state;
    s = applyCommand(applyCommand(s, { kind: 'endTurn' }).state, { kind: 'endTurn' }).state;
    s = applyCommand(s, { kind: 'move', unitId: cutter.id, to: { x: 4, y: 1 }, action: { type: 'capture' } }).state;
    expect(tileAt(s, 4, 1).owner).toBe('red');

    // A ship parked on an enemy port can't capture it.
    const enemyPort = createGame({ ...STRAIT, properties: [STRAIT.properties[0], { x: 2, y: 2, owner: 'blue' }, STRAIT.properties[2]] });
    expect(canCaptureAt(enemyPort, at(enemyPort, 3, 2), 2, 2)).toBe(false);
  });

  it('only a Frigate can target a Submarine', () => {
    const s = createGame({
      ...STRAIT,
      units: [
        { type: 'destroyer', owner: 'red', x: 3, y: 3 },
        { type: 'frigate', owner: 'red', x: 5, y: 3 },
        { type: 'submarine', owner: 'blue', x: 4, y: 3 },
        { type: 'infantry', owner: 'red', x: 0, y: 1 },
        { type: 'infantry', owner: 'blue', x: 8, y: 0 },
      ],
    });
    expect(attackableTargets(s, at(s, 3, 3), 3, 3, false)).toHaveLength(0);
    expect(attackableTargets(s, at(s, 5, 3), 5, 3, false).map((t) => t.type)).toEqual(['submarine']);
  });

  it('Destroyers and Cruisers stay out of shallows; Cutters sail through', () => {
    const s = createGame({
      ...STRAIT,
      units: [
        { type: 'destroyer', owner: 'red', x: 4, y: 3 },
        { type: 'cutter', owner: 'red', x: 3, y: 2 },
        { type: 'infantry', owner: 'blue', x: 8, y: 0 },
      ],
    });
    expect(reachableTiles(s, at(s, 4, 3)).has(key(4, 2))).toBe(false);
    expect(reachableTiles(s, at(s, 3, 2)).has(key(4, 2))).toBe(true);
  });

  it('a Cruiser shells the shore from 3 to 5 tiles away', () => {
    const s = createGame({
      ...STRAIT,
      units: [
        { type: 'cruiser', owner: 'red', x: 4, y: 4 },
        { type: 'infantry', owner: 'blue', x: 7, y: 4 }, // 3 away
        { type: 'infantry', owner: 'blue', x: 5, y: 4 }, // adjacent: too close
      ],
    });
    expect(attackableTargets(s, at(s, 4, 4), 4, 4, false).map((t) => `${t.x},${t.y}`)).toEqual(['7,4']);
  });
});

describe('naval AI', () => {
  it('sends its Cutter to take the oil rig', () => {
    let s = createGame(STRAIT);
    let steps = 0;
    while (tileAt(s, 4, 1).owner !== 'red' && s.day <= 5 && steps < 500 && !s.winner) {
      s = applyCommand(s, nextAiCommand(s, 'normal')).state;
      steps += 1;
    }
    expect(tileAt(s, 4, 1).owner).toBe('red');
  });

  it('builds a Cutter at a port while rigs are unclaimed', () => {
    // A city on Red's side keeps its soldier busy on land (not stranded), so no ferry is needed.
    const grid = [...STRAIT.grid];
    grid[3] = '.cswwws..';
    const s = createGame({ ...STRAIT, grid, units: STRAIT.units.filter((u) => u.type !== 'cutter'), startingFunds: { red: 6000, blue: 0 } });
    // Red's infantry moves first; then the port builds.
    let cmd = nextAiCommand(s, 'normal');
    let state = s;
    let steps = 0;
    while (cmd.kind !== 'build' && cmd.kind !== 'endTurn' && steps < 20) {
      state = applyCommand(state, cmd).state;
      cmd = nextAiCommand(state, 'normal');
      steps += 1;
    }
    expect(cmd).toMatchObject({ kind: 'build', unitType: 'cutter', at: { x: 2, y: 2 } });
  });
});
