import type { MapDef } from '../engine/types';
import { CROSSFIRE_VALLEY } from '../maps';

export interface Mission {
  name: string;
  /** Shown on the briefing screen before the mission starts. */
  briefing: string;
  /** One-line teaser for the mission list. */
  tagline: string;
  fog: boolean;
  map: MapDef;
}

/** You always command Red; the computer commands Blue. */
export const MISSIONS: Mission[] = [
  {
    name: 'First Steps',
    tagline: 'Learn to move, fight, and capture',
    briefing:
      'A Blue scouting party has crossed the border. Push them back! ' +
      'Click a unit to see its range, move, then attack when adjacent. ' +
      'Your tank crushes infantry — lead with it, and let your infantry ' +
      'capture the neutral cities for income. Destroy both Blue soldiers ' +
      'or march a foot unit onto their HQ and capture it.',
    fog: false,
    map: {
      name: 'First Steps',
      grid: [
        'w.f.....f.w',
        '...c...c...',
        '.f...m...f.',
        '.H.......H.',
        '.f...m...f.',
        '...c...c...',
        'w.f.....f.w',
      ],
      properties: [
        { x: 1, y: 3, owner: 'red' },
        { x: 3, y: 1, owner: 'red' },
        { x: 7, y: 5, owner: 'blue' },
        { x: 9, y: 3, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 2, y: 2 },
        { type: 'infantry', owner: 'red', x: 2, y: 4 },
        { type: 'infantry', owner: 'red', x: 2, y: 3 },
        { type: 'lightTank', owner: 'red', x: 3, y: 3 },
        { type: 'infantry', owner: 'blue', x: 8, y: 2 },
        { type: 'infantry', owner: 'blue', x: 8, y: 4 },
      ],
      startingFunds: 0,
    },
  },
  {
    name: 'Industrial Might',
    tagline: 'Factories, income, and the build order',
    briefing:
      'Blue holds the far side of an industrial valley. This time you have ' +
      'factories: click an empty one you own to build. Cities you capture ' +
      'pay $1000 every turn — the income war decides the arms race. ' +
      'Out-produce them, then overrun their HQ.',
    fog: false,
    map: {
      name: 'Industrial Might',
      grid: [
        'w..f..m..f..w',
        '.c..c.r.c..c.',
        '..F...r...F..',
        '.H.r.rrr.r.H.',
        '..F...r...F..',
        '.c..c.r.c..c.',
        'w..f..m..f..w',
      ],
      properties: [
        { x: 1, y: 3, owner: 'red' },
        { x: 2, y: 2, owner: 'red' },
        { x: 2, y: 4, owner: 'red' },
        { x: 1, y: 1, owner: 'red' },
        { x: 1, y: 5, owner: 'red' },
        { x: 11, y: 3, owner: 'blue' },
        { x: 10, y: 2, owner: 'blue' },
        { x: 10, y: 4, owner: 'blue' },
        { x: 11, y: 1, owner: 'blue' },
        { x: 11, y: 5, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 2, y: 3 },
        { type: 'infantry', owner: 'red', x: 3, y: 2 },
        { type: 'infantry', owner: 'blue', x: 10, y: 3 },
        { type: 'infantry', owner: 'blue', x: 9, y: 3 },
        { type: 'lightTank', owner: 'blue', x: 9, y: 4 },
      ],
      startingFunds: { red: 5000, blue: 2000 },
    },
  },
  {
    name: 'Thunder Ridge',
    tagline: 'Break a defended mountain pass',
    briefing:
      'Blue artillery guards the only two passes through the ridge. ' +
      'Artillery outranges everything but cannot fire after moving and is ' +
      'helpless up close — rush it with fast units, or bring your own guns ' +
      'and trade shells. Forests and mountains shield defenders; use them.',
    fog: false,
    map: {
      name: 'Thunder Ridge',
      grid: [
        'w.f..m.m..f.w',
        '.c...m.m...c.',
        '..f..r.r..f..',
        '.F...m.m...F.',
        '.H.r.rrr.r.H.',
        '.F...m.m...F.',
        '..f..r.r..f..',
        '.c...m.m...c.',
        'w.f..m.m..f.w',
      ],
      properties: [
        { x: 1, y: 4, owner: 'red' },
        { x: 1, y: 3, owner: 'red' },
        { x: 1, y: 5, owner: 'red' },
        { x: 1, y: 1, owner: 'red' },
        { x: 1, y: 7, owner: 'red' },
        { x: 11, y: 4, owner: 'blue' },
        { x: 11, y: 3, owner: 'blue' },
        { x: 11, y: 5, owner: 'blue' },
        { x: 11, y: 1, owner: 'blue' },
        { x: 11, y: 7, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 2, y: 3 },
        { type: 'infantry', owner: 'red', x: 2, y: 5 },
        { type: 'lightTank', owner: 'red', x: 3, y: 4 },
        { type: 'artillery', owner: 'red', x: 2, y: 4 },
        { type: 'infantry', owner: 'blue', x: 10, y: 3 },
        { type: 'infantry', owner: 'blue', x: 10, y: 5 },
        { type: 'lightTank', owner: 'blue', x: 9, y: 4 },
        { type: 'artillery', owner: 'blue', x: 8, y: 2 },
        { type: 'artillery', owner: 'blue', x: 8, y: 6 },
      ],
      startingFunds: { red: 6000, blue: 3000 },
    },
  },
  {
    name: 'Ghost Valley',
    tagline: 'Fight blind in the fog',
    briefing:
      'Dense forest, no visibility, and Blue ambushers somewhere in the ' +
      'trees. Under fog of war you only see what your units see — your ' +
      'recon sees farthest, so scout before you commit. Artillery cannot ' +
      'fire at what nobody has spotted. Move carefully.',
    fog: true,
    map: {
      name: 'Ghost Valley',
      grid: [
        'wff...c...ffw',
        '.f.f.....f.f.',
        'c..F..m..F..c',
        '.f...f.f...f.',
        '.H.r.r.r.r.H.',
        '.f...f.f...f.',
        'c..F..m..F..c',
        '.f.f.....f.f.',
        'wff...c...ffw',
      ],
      properties: [
        { x: 1, y: 4, owner: 'red' },
        { x: 3, y: 2, owner: 'red' },
        { x: 3, y: 6, owner: 'red' },
        { x: 0, y: 2, owner: 'red' },
        { x: 0, y: 6, owner: 'red' },
        { x: 11, y: 4, owner: 'blue' },
        { x: 9, y: 2, owner: 'blue' },
        { x: 9, y: 6, owner: 'blue' },
        { x: 12, y: 2, owner: 'blue' },
        { x: 12, y: 6, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 2, y: 3 },
        { type: 'infantry', owner: 'red', x: 2, y: 5 },
        { type: 'recon', owner: 'red', x: 2, y: 4 },
        { type: 'lightTank', owner: 'red', x: 4, y: 4 },
        { type: 'infantry', owner: 'blue', x: 10, y: 3 },
        { type: 'infantry', owner: 'blue', x: 10, y: 5 },
        { type: 'recon', owner: 'blue', x: 10, y: 4 },
        { type: 'bazooka', owner: 'blue', x: 8, y: 3 },
        { type: 'bazooka', owner: 'blue', x: 8, y: 5 },
      ],
      startingFunds: 4000,
    },
  },
  {
    name: 'Crossfire Valley',
    tagline: 'The decisive battle — fog, full map, uphill odds',
    briefing:
      'Everything comes together: the full front, fog of war, and a Blue ' +
      'war chest three times the size of yours. Win the income war early, ' +
      'screen your artillery, scout with recon — and take their HQ. ' +
      'Good luck, Commander.',
    fog: true,
    map: { ...CROSSFIRE_VALLEY, startingFunds: { red: 2000, blue: 6000 } },
  },
];
