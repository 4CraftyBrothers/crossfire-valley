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

/** Two vertical rivers, four bridges, an island of cities in between. */
export const TWIN_RIVERS: MapDef = {
  name: 'Twin Rivers',
  grid: [
    'f.c..w.c.w..c.f',
    '..F..w...w..F..',
    '.H.rrrrrrrrr.H.',
    '..F..w.m.w..F..',
    '.c...w.c.w...c.',
    '..f..w.m.w..f..',
    '..c.rrrrrrr.c..',
    '.....w...w.....',
    'f.c..w.c.w..c.f',
  ],
  properties: [
    { x: 1, y: 2, owner: 'red' },
    { x: 2, y: 1, owner: 'red' },
    { x: 2, y: 3, owner: 'red' },
    { x: 1, y: 4, owner: 'red' },
    { x: 13, y: 2, owner: 'blue' },
    { x: 12, y: 1, owner: 'blue' },
    { x: 12, y: 3, owner: 'blue' },
    { x: 13, y: 4, owner: 'blue' },
  ],
  units: [
    { type: 'infantry', owner: 'red', x: 3, y: 1 },
    { type: 'infantry', owner: 'red', x: 3, y: 3 },
    { type: 'lightTank', owner: 'red', x: 4, y: 2 },
    { type: 'recon', owner: 'red', x: 3, y: 4 },
    { type: 'artillery', owner: 'red', x: 1, y: 3 },
    { type: 'infantry', owner: 'blue', x: 11, y: 1 },
    { type: 'infantry', owner: 'blue', x: 11, y: 3 },
    { type: 'lightTank', owner: 'blue', x: 10, y: 2 },
    { type: 'recon', owner: 'blue', x: 11, y: 4 },
    { type: 'artillery', owner: 'blue', x: 13, y: 3 },
  ],
  startingFunds: 3000,
};

/** A walled city on the hill in the middle; the only way in is from the south. */
export const FORTRESS_HILL: MapDef = {
  name: 'Fortress Hill',
  grid: [
    'w.c.......c.w',
    '.F...f.f...F.',
    '..r.mmmmm.r..',
    '.H.r.mcm.r.H.',
    '..r.mm.mm.r..',
    '.F...f.f...F.',
    '..c..r.r..c..',
    'w...c...c...w',
    'ww.........ww',
  ],
  properties: [
    { x: 1, y: 3, owner: 'red' },
    { x: 1, y: 1, owner: 'red' },
    { x: 1, y: 5, owner: 'red' },
    { x: 2, y: 6, owner: 'red' },
    { x: 11, y: 3, owner: 'blue' },
    { x: 11, y: 1, owner: 'blue' },
    { x: 11, y: 5, owner: 'blue' },
    { x: 10, y: 6, owner: 'blue' },
  ],
  units: [
    { type: 'infantry', owner: 'red', x: 2, y: 2 },
    { type: 'infantry', owner: 'red', x: 2, y: 4 },
    { type: 'lightTank', owner: 'red', x: 3, y: 3 },
    { type: 'bazooka', owner: 'red', x: 2, y: 3 },
    { type: 'infantry', owner: 'blue', x: 10, y: 2 },
    { type: 'infantry', owner: 'blue', x: 10, y: 4 },
    { type: 'lightTank', owner: 'blue', x: 9, y: 3 },
    { type: 'bazooka', owner: 'blue', x: 10, y: 3 },
  ],
  startingFunds: 2000,
};

/** Sea to the north, a long front along the shore. */
export const COASTLINE: MapDef = {
  name: 'Coastline',
  grid: [
    'wwwwwwwwwwwwwww',
    'ww..c..w..c..ww',
    'w.F....w....F.w',
    '.H.rrr.c.rrr.H.',
    '..F..f...f..F..',
    '.c...m.c.m...c.',
    '..f..c...c..f..',
    'f.....m.m.....f',
  ],
  properties: [
    { x: 1, y: 3, owner: 'red' },
    { x: 2, y: 2, owner: 'red' },
    { x: 2, y: 4, owner: 'red' },
    { x: 1, y: 5, owner: 'red' },
    { x: 13, y: 3, owner: 'blue' },
    { x: 12, y: 2, owner: 'blue' },
    { x: 12, y: 4, owner: 'blue' },
    { x: 13, y: 5, owner: 'blue' },
  ],
  units: [
    { type: 'infantry', owner: 'red', x: 3, y: 2 },
    { type: 'infantry', owner: 'red', x: 3, y: 4 },
    { type: 'lightTank', owner: 'red', x: 4, y: 3 },
    { type: 'recon', owner: 'red', x: 3, y: 5 },
    { type: 'artillery', owner: 'red', x: 1, y: 4 },
    { type: 'infantry', owner: 'blue', x: 11, y: 2 },
    { type: 'infantry', owner: 'blue', x: 11, y: 4 },
    { type: 'lightTank', owner: 'blue', x: 10, y: 3 },
    { type: 'recon', owner: 'blue', x: 11, y: 5 },
    { type: 'artillery', owner: 'blue', x: 13, y: 4 },
  ],
  startingFunds: 3000,
};

/** Small and fast: two roads cross in the middle over the richest city. */
export const CROSSROADS: MapDef = {
  name: 'Crossroads',
  grid: [
    'w.c.....c.w',
    '.F..r.r..F.',
    '....r.r....',
    '.H.rrrrr.H.',
    '.F..r.r..F.',
    'c...rcr...c',
    '.f..r.r..f.',
    '....rrr....',
    '.c..r.r..c.',
    '.m...c...m.',
    'w....f....w',
  ],
  properties: [
    { x: 1, y: 3, owner: 'red' },
    { x: 1, y: 1, owner: 'red' },
    { x: 1, y: 4, owner: 'red' },
    { x: 2, y: 0, owner: 'red' },
    { x: 9, y: 3, owner: 'blue' },
    { x: 9, y: 1, owner: 'blue' },
    { x: 9, y: 4, owner: 'blue' },
    { x: 8, y: 0, owner: 'blue' },
  ],
  units: [
    { type: 'infantry', owner: 'red', x: 2, y: 2 },
    { type: 'infantry', owner: 'red', x: 2, y: 4 },
    { type: 'lightTank', owner: 'red', x: 3, y: 3 },
    { type: 'infantry', owner: 'blue', x: 8, y: 2 },
    { type: 'infantry', owner: 'blue', x: 8, y: 4 },
    { type: 'lightTank', owner: 'blue', x: 7, y: 3 },
  ],
  startingFunds: 2000,
};

/** Built-in maps offered in Skirmish. The first is the default. */
export const SKIRMISH_MAPS: MapDef[] = [CROSSFIRE_VALLEY, TWIN_RIVERS, FORTRESS_HILL, COASTLINE, CROSSROADS];
