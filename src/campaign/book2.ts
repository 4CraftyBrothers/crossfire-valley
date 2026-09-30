import type { Act, Mission } from './missions';
import type { TutorialStep } from './tutorial';

/**
 * Book II — Skies and Seas. Commodore Kade kept Blue's navy out of the
 * surrender and holds the islands and oil of the Sapphire Coast. The Book
 * introduces transports, ships, oil, cloaks, jets, and turrets, paced the
 * way MASTER_PLAN §1 describes: given forces first, then bases, then the
 * sea in force.
 *
 * Global mission indices start after Book I (24).
 */
export const BOOK_TWO_START = 24;

export const BOOK_TWO_ACTS: Act[] = [{ title: 'Act I — Landfall', start: BOOK_TWO_START }];

function islandHopTutorial(): TutorialStep[] {
  return [
    {
      text: 'Soldiers can’t swim. Select an <b>Infantry</b>, then tap the <b>Skylift</b> to board it.',
      highlight: [{ x: 3, y: 2 }],
      done: (f) => f.boarded,
    },
    {
      text: 'Now select the Skylift, fly it over the water, and choose <b>Unload</b> beside an island city.',
      highlight: [
        { x: 9, y: 1 },
        { x: 9, y: 3 },
      ],
      done: (f) => f.unloaded,
    },
    {
      text: 'Hold <b>3 buildings</b>: your HQ and both island cities. The Skylift can fetch the second soldier; the helicopter can clear the way.',
      done: () => false,
      final: true,
    },
  ];
}

function beachheadTutorial(): TutorialStep[] {
  return [
    {
      text: 'A <b>Barge</b> carries two ground units. Drive a tank onto a Barge on the beach to board it.',
      highlight: [
        { x: 4, y: 2 },
        { x: 4, y: 4 },
      ],
      done: (f) => f.boarded,
    },
    {
      text: 'Barges sail on water and beach on <b>shore</b> tiles. Cross the channel, then <b>Unload</b> onto the far bank.',
      highlight: [
        { x: 9, y: 2 },
        { x: 9, y: 4 },
      ],
      done: (f) => f.unloaded,
    },
    {
      text: 'Blue’s artillery covers the beach. Land together, then take their <b>HQ</b>.',
      highlight: [{ x: 13, y: 0 }],
      done: () => false,
      final: true,
    },
  ];
}

function blackGoldTutorial(): TutorialStep[] {
  return [
    {
      text: '<b>Refineries</b> pay $2000 a turn, twice a city. Send Infantry to capture one.',
      highlight: [
        { x: 4, y: 1 },
        { x: 9, y: 0 },
      ],
      done: (f) => f.captured,
    },
    {
      text: 'Tap a refinery you own to <b>upgrade</b> it. It costs money now and pays more every turn after.',
      done: (f) => f.upgraded,
    },
    {
      text: 'Hold <b>6 buildings</b> to win. Blue wants the oil as much as you do.',
      done: () => false,
      final: true,
    },
  ];
}

export const BOOK_TWO_MISSIONS: Mission[] = [
  {
    name: 'Island Hop',
    tagline: 'Fly troops across the water',
    briefing:
      'Kade’s garrison holds two cities on the island across the channel, and ' +
      'your soldiers can’t swim. A Skylift carries one foot soldier over ' +
      'anything: board it, fly over, and set them down beside a city. Hold ' +
      'three buildings to take the island.',
    fog: false,
    difficulty: 'easy',
    objective: { kind: 'capture', count: 3 },
    par: 6,
    tutorial: islandHopTutorial,
    map: {
      name: 'Island Hop',
      grid: ['H...wwww..fw', '....wwww.c.w', '..f.wwww....', '....wwww.c.H', '.f..wwww....', '....wwww.f.w'],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 11, y: 3, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'infantry', owner: 'red', x: 2, y: 3 },
        { type: 'skylift', owner: 'red', x: 3, y: 2 },
        { type: 'helicopter', owner: 'red', x: 1, y: 4 },
        { type: 'infantry', owner: 'blue', x: 10, y: 2 },
        { type: 'bazooka', owner: 'blue', x: 10, y: 4 },
      ],
      startingFunds: 0,
    },
  },
  {
    name: 'Beachhead',
    tagline: 'Land armor on a defended shore',
    briefing:
      'Kade’s troops dug in on the far side of the channel. Barges carry two ' +
      'ground units each; they load and unload on shore tiles, the only place ' +
      'land meets sea. Blue artillery covers the landing, so cross together ' +
      'and hit the guns first. Take the HQ.',
    fog: false,
    difficulty: 'normal',
    par: 10,
    tutorial: beachheadTutorial,
    map: {
      name: 'Beachhead',
      grid: [
        'H...swwwws..fH',
        '..f.swwwws....',
        '....swwwws.c..',
        '.c..swwwws..m.',
        '....swwwws....',
        '..f.swwwws.f..',
        '....swwwwsc...',
      ],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 13, y: 0, owner: 'blue' },
      ],
      units: [
        { type: 'lightTank', owner: 'red', x: 2, y: 2 },
        { type: 'lightTank', owner: 'red', x: 2, y: 4 },
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'infantry', owner: 'red', x: 1, y: 5 },
        { type: 'barge', owner: 'red', x: 4, y: 2 },
        { type: 'barge', owner: 'red', x: 4, y: 4 },
        { type: 'infantry', owner: 'blue', x: 11, y: 1 },
        { type: 'bazooka', owner: 'blue', x: 10, y: 3 },
        { type: 'artillery', owner: 'blue', x: 12, y: 2 },
      ],
      startingFunds: 0,
    },
  },
  {
    name: 'Black Gold',
    tagline: 'Refineries, and what oil money buys',
    briefing:
      'The oil fields are up for grabs. Refineries pay $2000 a turn, and an ' +
      'owned refinery can be upgraded to pay more. Build infantry, spread out, ' +
      'and hold six buildings before Blue does. Every upgrade pays for itself ' +
      'in a few turns.',
    fog: false,
    difficulty: 'normal',
    objective: { kind: 'capture', count: 6 },
    par: 14,
    tutorial: blackGoldTutorial,
    map: {
      name: 'Black Gold',
      grid: [
        'HF..f....R.w',
        '.r..R..f...w',
        '.r.....m..c.',
        '.rrrrrrrrr..',
        '..c..m.....r',
        'w...f..R..r.',
        'w.R....f..FH',
      ],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 1, y: 0, owner: 'red' },
        { x: 11, y: 6, owner: 'blue' },
        { x: 10, y: 6, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 0, y: 1 },
        { type: 'infantry', owner: 'red', x: 2, y: 1 },
        { type: 'recon', owner: 'red', x: 1, y: 2 },
        { type: 'infantry', owner: 'blue', x: 11, y: 5 },
        { type: 'infantry', owner: 'blue', x: 9, y: 6 },
        { type: 'recon', owner: 'blue', x: 10, y: 4 },
      ],
      startingFunds: 3000,
    },
  },
];
