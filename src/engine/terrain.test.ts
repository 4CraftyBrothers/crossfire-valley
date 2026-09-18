import { describe, expect, it } from 'vitest';
import { applyCommand } from './game';
import { key, reachableTiles } from './movement';
import { validateMapDef } from './serialize';
import { createGame, incomeFor } from './state';
import type { MapDef } from './types';

const MAP: MapDef = {
  name: 'Book II tiles',
  grid: [
    'H.s.xbx.H',
    '...v.....',
    '..R......',
    '.........',
    '.........',
  ],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 8, y: 0, owner: 'blue' },
    { x: 2, y: 2, owner: 'red' },
  ],
  units: [
    { type: 'infantry', owner: 'red', x: 3, y: 0 },
    { type: 'helicopter', owner: 'red', x: 2, y: 1 },
    { type: 'infantry', owner: 'blue', x: 7, y: 3 },
  ],
  startingFunds: 0,
};

describe('Book II terrain', () => {
  it('validates and builds a game with shore, shallows, bridge, volcano and refinery', () => {
    expect(validateMapDef(MAP)).toEqual([]);
    const s = createGame(MAP);
    expect(s.tiles[2].terrain).toBe('shore');
    expect(s.tiles[4].terrain).toBe('shallow');
    expect(s.tiles[5].terrain).toBe('bridge');
    expect(s.tiles[1 * 9 + 3].terrain).toBe('volcano');
    expect(s.tiles[2 * 9 + 2].terrain).toBe('refinery');
  });

  it('refineries pay double', () => {
    const s = createGame(MAP);
    expect(incomeFor(s, 'red')).toBe(3000); // HQ 1000 + refinery 2000
    expect(s.funds.red).toBe(3000);
    const blue = applyCommand(s, { kind: 'endTurn' });
    expect(blue.events.find((e) => e.type === 'turnStarted')).toMatchObject({ income: 1000 });
  });

  it('infantry walks the shore but not the shallows', () => {
    const s = createGame(MAP);
    const inf = s.units.find((u) => u.type === 'infantry' && u.owner === 'red')!;
    const reach = reachableTiles(s, inf);
    expect(reach.has(key(2, 0))).toBe(true); // shore
    expect(reach.has(key(4, 0))).toBe(false); // shallows
    expect(reach.has(key(3, 1))).toBe(false); // volcano
  });

  it('bridges are reached across land and volcanoes stop even aircraft', () => {
    const s = createGame({
      ...MAP,
      grid: ['H.......H', '...bxxx..', '...v.....', '.........', '.........'],
      units: [
        { type: 'infantry', owner: 'red', x: 2, y: 1 },
        { type: 'helicopter', owner: 'red', x: 2, y: 2 },
        { type: 'infantry', owner: 'blue', x: 7, y: 3 },
      ],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 8, y: 0, owner: 'blue' },
      ],
    });
    const inf = s.units.find((u) => u.type === 'infantry' && u.owner === 'red')!;
    expect(reachableTiles(s, inf).has(key(3, 1))).toBe(true);
    expect(reachableTiles(s, inf).has(key(4, 1))).toBe(false);
    const heli = s.units.find((u) => u.type === 'helicopter')!;
    expect(reachableTiles(s, heli).has(key(3, 2))).toBe(false);
    expect(reachableTiles(s, heli).has(key(4, 1))).toBe(true);
  });

  it('rejects units placed on volcanoes', () => {
    const errors = validateMapDef({ ...MAP, units: [{ type: 'helicopter', owner: 'red', x: 3, y: 1 }, ...MAP.units] });
    expect(errors.join(' ')).toMatch(/cannot stand on volcano/);
  });
});
