import { describe, expect, it } from 'vitest';
import { key } from './movement';
import { createGame } from './state';
import { threatArea } from './threat';
import type { MapDef } from './types';

const MAP: MapDef = {
  name: 'Threat',
  grid: ['H........', '.........', '.........', '.........', '........H'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 8, y: 4, owner: 'blue' },
  ],
  units: [
    { type: 'infantry', owner: 'blue', x: 4, y: 2 },
    { type: 'artillery', owner: 'blue', x: 7, y: 2 },
    { type: 'infantry', owner: 'red', x: 1, y: 2 },
  ],
  startingFunds: 0,
};

describe('threatArea', () => {
  it('a direct unit threatens one tile past everywhere it can walk', () => {
    const s = createGame(MAP);
    const inf = s.units.find((u) => u.type === 'infantry' && u.owner === 'blue')!;
    const { move, attack } = threatArea(s, inf);
    expect(move.has(key(4, 2))).toBe(true);
    expect(move.has(key(1, 2))).toBe(false); // 3 plains away is reachable, but Red stands there
    expect(attack.has(key(1, 2))).toBe(true); // ...so it can be hit from next door
    expect(attack.has(key(0, 2))).toBe(false); // 4 moves + 1 is out of reach
  });

  it('an indirect unit threatens its ring from where it stands, not after moving', () => {
    const s = createGame(MAP);
    const art = s.units.find((u) => u.type === 'artillery')!;
    const { move, attack } = threatArea(s, art);
    expect(move.size).toBeGreaterThan(1);
    expect(attack.has(key(7, 1))).toBe(false); // adjacent: inside min range
    expect(attack.has(key(5, 2))).toBe(true); // 2 away
    expect(attack.has(key(4, 2))).toBe(true); // 3 away
    expect(attack.has(key(3, 2))).toBe(false); // 4 away
  });
});
