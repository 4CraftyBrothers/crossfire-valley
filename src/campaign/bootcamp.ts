import type { MapDef, Objective } from '../engine/types';
import type { TutorialStep } from './tutorial';

/**
 * Boot Camp: short lessons on tiny maps, separate from the campaign. Each
 * one plays against an easy Blue with its tutorial always on, and is won
 * the normal way (or by its objective).
 */
export interface Lesson {
  name: string;
  /** One line for the lesson list. */
  blurb: string;
  fog: boolean;
  objective?: Objective;
  map: MapDef;
  steps: () => TutorialStep[];
}

const HQS = (w: number, h: number): MapDef['properties'] => [
  { x: 0, y: 0, owner: 'red' },
  { x: w - 1, y: h - 1, owner: 'blue' },
];

export const LESSONS: Lesson[] = [
  {
    name: 'Move and attack',
    blurb: 'Select, move, and fight',
    fog: false,
    map: {
      name: 'Boot Camp 1',
      grid: ['H......', '.......', '.......', '.......', '......H'],
      properties: HQS(7, 5),
      units: [
        { type: 'lightTank', owner: 'red', x: 1, y: 2 },
        { type: 'infantry', owner: 'red', x: 0, y: 1 },
        { type: 'infantry', owner: 'blue', x: 4, y: 2 },
        { type: 'infantry', owner: 'blue', x: 5, y: 3 },
      ],
      startingFunds: 0,
    },
    steps: () => [
      {
        text: 'Tap your <b>Light Tank</b> to select it.',
        highlight: [{ x: 1, y: 2 }],
        done: (f) => f.selected.has('lightTank') || f.moved.has('lightTank'),
      },
      {
        text: 'Blue tiles show where it can go. Tap one, then choose <b>Done</b> to stop there.',
        done: (f) => f.moved.has('lightTank'),
      },
      {
        text: 'Now fight. With a unit selected, <b>tap an enemy</b> to see the damage forecast, and tap it again to fire.',
        done: (f) => f.attacked,
      },
      {
        text: 'A unit that survives shoots back: that is the <b>counter</b>. Destroy both soldiers to win.',
        done: () => false,
        final: true,
      },
    ],
  },
  {
    name: 'Cover and counters',
    blurb: 'Terrain protects, and enemies shoot back',
    fog: false,
    map: {
      name: 'Boot Camp 2',
      grid: ['H..f...', '...f...', '.....f.', '..f....', '......H'],
      properties: HQS(7, 5),
      units: [
        { type: 'lightTank', owner: 'red', x: 0, y: 2 },
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'infantry', owner: 'red', x: 1, y: 3 },
        { type: 'infantry', owner: 'blue', x: 3, y: 1 },
        { type: 'infantry', owner: 'blue', x: 5, y: 2 },
      ],
      startingFunds: 0,
    },
    steps: () => [
      {
        text: 'Tap a <b>Blue soldier</b>. The red area is where it can move and strike next turn.',
        highlight: [
          { x: 3, y: 1 },
          { x: 5, y: 2 },
        ],
        done: (f) => f.inspected || f.attacked,
      },
      {
        text: 'Both are in <b>forests</b>. Each ★ of cover cuts the damage a unit takes. Check the forecast, then attack.',
        done: (f) => f.attacked,
      },
      {
        text: 'Your units get cover too. Park them in forests or on buildings and make Blue attack into them.',
        done: (f) => f.endedTurn,
      },
      {
        text: 'Wounded units hit softer, so finish off the weak ones first. Clear the field to win.',
        done: () => false,
        final: true,
      },
    ],
  },
  {
    name: 'Capture and income',
    blurb: 'Take cities, collect money',
    fog: false,
    objective: { kind: 'capture', count: 3 },
    map: {
      name: 'Boot Camp 3',
      grid: ['H...c...', '..c.....', '........', '.....c..', '...c...H'],
      properties: HQS(8, 5),
      units: [
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'infantry', owner: 'red', x: 1, y: 0 },
        { type: 'infantry', owner: 'blue', x: 6, y: 3 },
      ],
      startingFunds: 0,
    },
    steps: () => [
      {
        text: 'Cities pay <b>$1000</b> a turn to their owner. Move an <b>Infantry</b> onto a city and choose <b>Capture</b>.',
        highlight: [
          { x: 2, y: 1 },
          { x: 4, y: 0 },
        ],
        done: (f) => f.captured,
      },
      {
        text: 'A healthy soldier needs <b>two turns</b> to capture. Press <b>End Turn</b>.',
        done: (f) => f.endedTurn,
      },
      {
        text: 'Keep capturing until you hold <b>3 buildings</b> (your HQ counts). The pill at the top keeps score.',
        done: () => false,
        final: true,
      },
    ],
  },
  {
    name: 'Build an army',
    blurb: 'Factories turn money into units',
    fog: false,
    map: {
      name: 'Boot Camp 4',
      grid: ['H.F.....', '........', '...c....', '........', '.......H'],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 2, y: 0, owner: 'red' },
        { x: 7, y: 4, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'infantry', owner: 'blue', x: 6, y: 3 },
      ],
      startingFunds: { red: 3000, blue: 0 },
    },
    steps: () => [
      {
        text: 'Tap your empty <b>factory</b> to see what it can build.',
        highlight: [{ x: 2, y: 0 }],
        done: (f) => f.openedBuild || f.built,
      },
      {
        text: 'Pick a unit you can afford. <b>Infantry</b> is cheap and can capture. New units move next turn.',
        done: (f) => f.built,
      },
      {
        text: 'Everything you own pays at the start of your turn. Press <b>End Turn</b> to collect.',
        done: (f) => f.endedTurn,
      },
      {
        text: 'Keep building, grab the middle city, and take the Blue <b>HQ</b>.',
        highlight: [{ x: 7, y: 4 }],
        done: () => false,
        final: true,
      },
    ],
  },
  {
    name: 'Direct and indirect',
    blurb: 'Artillery hits from range',
    fog: false,
    map: {
      name: 'Boot Camp 5',
      grid: ['H........', '...m.....', '.........', '...m.....', '........H'],
      properties: HQS(9, 5),
      units: [
        { type: 'artillery', owner: 'red', x: 1, y: 2 },
        { type: 'lightTank', owner: 'red', x: 2, y: 1 },
        { type: 'lightTank', owner: 'blue', x: 6, y: 2 },
        { type: 'infantry', owner: 'blue', x: 7, y: 1 },
      ],
      startingFunds: 0,
    },
    steps: () => [
      {
        text: '<b>Artillery</b> fires 2–3 tiles away, but never on a turn it moves. Tap it.',
        highlight: [{ x: 1, y: 2 }],
        done: (f) => f.selected.has('artillery') || f.moved.has('artillery'),
      },
      {
        text: 'Leave it where it is and let Blue walk into range. Move your tank if you like, then <b>End Turn</b>.',
        done: (f) => f.endedTurn || f.attackedWith.has('artillery'),
      },
      {
        text: 'Enemy in range? Select the artillery and tap the enemy. No move needed, and tanks can\'t shoot back at it.',
        done: (f) => f.attackedWith.has('artillery'),
      },
      {
        text: 'Artillery can\'t hit anything right next to it. Keep your tank in front as a shield and finish them.',
        done: () => false,
        final: true,
      },
    ],
  },
  {
    name: 'Air and anti-air',
    blurb: 'Helicopters, and what stops them',
    fog: false,
    map: {
      name: 'Boot Camp 6',
      grid: ['H..mw...', '...mw...', '...rr...', '...mw...', '...mw..H'],
      properties: HQS(8, 5),
      units: [
        { type: 'antiAir', owner: 'red', x: 1, y: 2 },
        { type: 'helicopter', owner: 'red', x: 1, y: 3 },
        { type: 'infantry', owner: 'red', x: 0, y: 1 },
        { type: 'helicopter', owner: 'blue', x: 6, y: 1 },
        { type: 'infantry', owner: 'blue', x: 6, y: 3 },
      ],
      startingFunds: 0,
    },
    steps: () => [
      {
        text: '<b>Helicopters</b> fly over mountains and water and get no cover. Tap Blue\'s helicopter to see its reach.',
        highlight: [{ x: 6, y: 1 }],
        done: (f) => f.inspected || f.moved.has('antiAir'),
      },
      {
        text: 'Your <b>Anti-Air</b> shreds aircraft. Move it where it guards your other units.',
        highlight: [{ x: 1, y: 2 }],
        done: (f) => f.moved.has('antiAir'),
      },
      {
        text: 'Your own <b>Helicopter</b> can hunt infantry anywhere. Keep it away from enemy anti-air.',
        highlight: [{ x: 1, y: 3 }],
        done: (f) => f.moved.has('helicopter'),
      },
      {
        text: 'Win the sky, then clear the ground.',
        done: () => false,
        final: true,
      },
    ],
  },
  {
    name: 'Fog and ambush',
    blurb: 'See before you are seen',
    fog: true,
    map: {
      name: 'Boot Camp 7',
      grid: ['H..f.f...', '...f.f...', '.........', '...f.f...', '...f.f..H'],
      properties: HQS(9, 5),
      units: [
        { type: 'recon', owner: 'red', x: 1, y: 2 },
        { type: 'infantry', owner: 'red', x: 0, y: 1 },
        { type: 'lightTank', owner: 'red', x: 1, y: 3 },
        { type: 'infantry', owner: 'blue', x: 5, y: 1 },
        { type: 'infantry', owner: 'blue', x: 5, y: 3 },
      ],
      startingFunds: 0,
    },
    steps: () => [
      {
        text: 'Under <b>fog of war</b> you only see what your units see. The dark tiles could hide anything.',
        done: (f) => f.selected.size > 0 || f.movedAny,
      },
      {
        text: '<b>Recon</b> sees farther than anything else. Scout ahead with it.',
        highlight: [{ x: 1, y: 2 }],
        done: (f) => f.moved.has('recon'),
      },
      {
        text: 'Units in <b>forests</b> stay hidden until something is right next to them. Walk into one and you are <b>ambushed</b>: your unit stops short.',
        done: (f) => f.endedTurn,
      },
      {
        text: 'Find both soldiers, or walk your Infantry into Blue\'s <b>HQ</b>.',
        highlight: [{ x: 8, y: 4 }],
        done: () => false,
        final: true,
      },
    ],
  },
];

// Lesson 8 arrived with Book II.
LESSONS.push({
  name: 'Transports and sea',
  blurb: 'Carry troops across water',
  fog: false,
  objective: { kind: 'capture', count: 3 },
  map: {
    name: 'Boot Camp 8',
    grid: ['H..swws.c', '...swws..', '...swws.H', '...swws..', '...swws.c'],
    properties: [
      { x: 0, y: 0, owner: 'red' },
      { x: 8, y: 2, owner: 'blue' },
    ],
    units: [
      { type: 'infantry', owner: 'red', x: 1, y: 1 },
      { type: 'lightTank', owner: 'red', x: 1, y: 3 },
      { type: 'barge', owner: 'red', x: 3, y: 2 },
      { type: 'infantry', owner: 'blue', x: 7, y: 1 },
    ],
    startingFunds: 0,
  },
  steps: () => [
    {
      text: 'Nobody can walk across water. Drive a unit onto the <b>Barge</b> on the shore to board it. It carries two.',
      highlight: [{ x: 3, y: 2 }],
      done: (f) => f.boarded,
    },
    {
      text: 'Select the Barge, sail to the far <b>shore</b>, and choose <b>Unload</b>. Load the second unit first if you like.',
      highlight: [
        { x: 6, y: 1 },
        { x: 6, y: 2 },
        { x: 6, y: 3 },
      ],
      done: (f) => f.unloaded,
    },
    {
      text: 'Hold <b>3 buildings</b>: your HQ and both cities across the water.',
      highlight: [
        { x: 8, y: 0 },
        { x: 8, y: 4 },
      ],
      done: () => false,
      final: true,
    },
  ],
});

const DONE_KEY = 'crossfire-valley-bootcamp';

/** Lessons finished, by index. */
export function lessonsDone(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as number[]);
  } catch {
    return new Set();
  }
}

export function markLessonDone(index: number): void {
  const done = lessonsDone();
  done.add(index);
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    /* storage unavailable */
  }
}
