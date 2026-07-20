import type { MapDef } from '../engine/types';

/**
 * Crossfire Valley — a symmetric 15x10 skirmish map. Each side starts with
 * an HQ, two factories, two cities, and a small strike force. Seven neutral
 * cities decide the income war.
 */
export const CROSSFIRE_VALLEY: MapDef = {
  name: 'Crossfire Valley',
  grid: [
    'wwf..m.c.m..fww',
    'w..c..rrr..c..w',
    'f.F.f.r.r.f.F.f',
    '.H...crmrc...H.',
    '..F.f.r.r.f.F..',
    '..rrrrrcrrrrr..',
    'c...m.....m...c',
    '.f.c..f.f..c.f.',
    'w....m.c.m....w',
    'wwf.........fww',
  ],
  properties: [
    // Red
    { x: 1, y: 3, owner: 'red' },
    { x: 2, y: 2, owner: 'red' },
    { x: 2, y: 4, owner: 'red' },
    { x: 3, y: 1, owner: 'red' },
    { x: 0, y: 6, owner: 'red' },
    // Blue
    { x: 13, y: 3, owner: 'blue' },
    { x: 12, y: 2, owner: 'blue' },
    { x: 12, y: 4, owner: 'blue' },
    { x: 11, y: 1, owner: 'blue' },
    { x: 14, y: 6, owner: 'blue' },
  ],
  units: [
    { type: 'infantry', owner: 'red', x: 3, y: 2 },
    { type: 'infantry', owner: 'red', x: 3, y: 4 },
    { type: 'lightTank', owner: 'red', x: 4, y: 3 },
    { type: 'recon', owner: 'red', x: 2, y: 5 },
    { type: 'artillery', owner: 'red', x: 1, y: 4 },

    { type: 'infantry', owner: 'blue', x: 11, y: 2 },
    { type: 'infantry', owner: 'blue', x: 11, y: 4 },
    { type: 'lightTank', owner: 'blue', x: 10, y: 3 },
    { type: 'recon', owner: 'blue', x: 12, y: 5 },
    { type: 'artillery', owner: 'blue', x: 13, y: 4 },
  ],
  startingFunds: 2000,
};
