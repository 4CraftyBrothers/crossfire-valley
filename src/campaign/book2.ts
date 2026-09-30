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

export const BOOK_TWO_ACTS: Act[] = [
  { title: 'Act I — Landfall', start: BOOK_TWO_START },
  { title: 'Act II — Open Water', start: BOOK_TWO_START + 4 },
];

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

function harbourWorksTutorial(): TutorialStep[] {
  return [
    {
      text: 'Only a <b>Cutter</b> can capture an oil rig. Sail yours onto a rig and choose <b>Capture</b>.',
      highlight: [
        { x: 6, y: 3 },
        { x: 8, y: 5 },
      ],
      done: (f) => f.captured,
    },
    {
      text: 'Your <b>Port</b> builds ships. Each Port you own makes ships 5% cheaper.',
      highlight: [{ x: 3, y: 3 }],
      done: (f) => f.built,
    },
    {
      text: 'Rigs pay $1500 a turn. Hold the sea and the road, then take the Blue <b>HQ</b>.',
      highlight: [{ x: 13, y: 0 }],
      done: () => false,
      final: true,
    },
  ];
}

function ghostsTutorial(): TutorialStep[] {
  return [
    {
      text: 'Blue has <b>Stealth Tanks</b>: invisible until one of your units stands next to them, fog or not.',
      done: (f) => f.movedAny,
    },
    {
      text: 'Infantry that walk into a hidden tank attack it on the spot. Scout with Recon and move in pairs.',
      done: (f) => f.endedTurn,
    },
    {
      text: 'A Stealth Tank’s first strike from hiding does double damage. Find them, then take the Blue <b>HQ</b>.',
      highlight: [{ x: 11, y: 7 }],
      done: () => false,
      final: true,
    },
  ];
}

function fleetTutorial(): TutorialStep[] {
  return [
    {
      text: 'Blue <b>Submarines</b> hide underwater. Only a <b>Frigate</b> can target one, once something is next to it.',
      highlight: [{ x: 5, y: 2 }],
      done: (f) => f.moved.has('frigate'),
    },
    {
      text: 'Keep the Frigate beside your <b>Destroyer</b>: the Frigate finds subs, the Destroyer handles ships.',
      done: (f) => f.endedTurn,
    },
    {
      text: 'Hold <b>6 buildings</b>. Your Cutter can take the oil rigs once the sea is safe.',
      highlight: [
        { x: 7, y: 2 },
        { x: 5, y: 6 },
      ],
      done: () => false,
      final: true,
    },
  ];
}

function cutOffTutorial(): TutorialStep[] {
  return [
    {
      text: '<b>Bombers</b> wreck anything on the ground and never shoot back. <b>Anti-Air</b> and Fighters stop them.',
      highlight: [
        { x: 2, y: 3 },
        { x: 1, y: 5 },
      ],
      done: (f) => f.moved.has('antiAir'),
    },
    {
      text: 'Your <b>Turrets</b> never move, but hit anything 2–5 tiles away and repair themselves each turn.',
      highlight: [
        { x: 4, y: 2 },
        { x: 3, y: 6 },
      ],
      done: (f) => f.endedTurn,
    },
    {
      text: 'Hold your <b>HQ</b> until day 8. Your Airbase can build Fighters.',
      highlight: [{ x: 1, y: 1 }],
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
  {
    name: 'Harbour Works',
    tagline: 'Your first port, and oil at sea',
    briefing:
      'A road runs along the northern cliffs and a sound opens below it, with ' +
      'two oil rigs out on the water. Your Port builds ships; a Cutter is the ' +
      'only thing that can capture a rig. Fight for the road with your ' +
      'factory, claim the rigs with your navy, and take the Blue HQ.',
    fog: false,
    difficulty: 'normal',
    par: 14,
    tutorial: harbourWorksTutorial,
    map: {
      name: 'Harbour Works',
      grid: [
        'H.F..rrrr..F.H',
        '.f...r..r...f.',
        '..c.swwwws.c..',
        '..sPwwOwwwPs..',
        '..swwwwwwwwws.',
        '.c.swwwwOwws.c',
        '...sswwwwwss..',
        'f.c..s.xx.s.cf',
      ],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 2, y: 0, owner: 'red' },
        { x: 3, y: 3, owner: 'red' },
        { x: 13, y: 0, owner: 'blue' },
        { x: 11, y: 0, owner: 'blue' },
        { x: 10, y: 3, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'infantry', owner: 'red', x: 3, y: 0 },
        { type: 'lightTank', owner: 'red', x: 1, y: 2 },
        { type: 'cutter', owner: 'red', x: 4, y: 3 },
        { type: 'infantry', owner: 'blue', x: 12, y: 1 },
        { type: 'infantry', owner: 'blue', x: 10, y: 0 },
        { type: 'lightTank', owner: 'blue', x: 12, y: 2 },
        { type: 'cutter', owner: 'blue', x: 9, y: 3 },
      ],
      startingFunds: 5000,
    },
  },
  {
    name: 'Open Water',
    tagline: 'A sea between the armies',
    briefing:
      'Open sea splits this front in two. Each side has a factory, an Airbase ' +
      'and a Port on its own shore, and two oil rigs sit in the middle of the ' +
      'water. Hold ten buildings to win: your own shore alone won’t get you ' +
      'there, so the rigs, and whoever rules the sea, decide it. Barges and ' +
      'Skylifts can carry the fight across.',
    fog: false,
    difficulty: 'normal',
    objective: { kind: 'capture', count: 10 },
    par: 16,
    map: {
      name: 'Open Water',
      grid: [
        'H.F.A.f....c..f.',
        '.rrrrr..c...m...',
        '.c...r.f....f.c.',
        'ssssPsssssssssss',
        'wwwwwwwOwwwwwwww',
        'wwwwwwwwOwwwwwww',
        'sssssssssssPssss',
        '.c.f....f.r...c.',
        '...m...c..rrrrr.',
        '.f..c....f.A.F.H',
      ],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 2, y: 0, owner: 'red' },
        { x: 4, y: 0, owner: 'red' },
        { x: 4, y: 3, owner: 'red' },
        { x: 15, y: 9, owner: 'blue' },
        { x: 13, y: 9, owner: 'blue' },
        { x: 11, y: 9, owner: 'blue' },
        { x: 11, y: 6, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 1, y: 1 },
        { type: 'infantry', owner: 'red', x: 3, y: 2 },
        { type: 'lightTank', owner: 'red', x: 5, y: 2 },
        { type: 'cutter', owner: 'red', x: 6, y: 4 },
        { type: 'cutter', owner: 'red', x: 3, y: 4 },
        { type: 'infantry', owner: 'blue', x: 14, y: 8 },
        { type: 'infantry', owner: 'blue', x: 12, y: 7 },
        { type: 'lightTank', owner: 'blue', x: 10, y: 7 },
        { type: 'cutter', owner: 'blue', x: 9, y: 5 },
      ],
      startingFunds: { red: 6000, blue: 3000 },
    },
  },
  {
    name: 'Ghosts in the Reeds',
    tagline: 'Hunt stealth tanks in the fog',
    briefing:
      'Kade has fielded Stealth Tanks in the marsh forest. You won’t see them ' +
      'until one of your units is right next to one, and their first shot from ' +
      'hiding does double damage. Infantry that bump into one attack it. ' +
      'Scout with your Recon, move in pairs, and take the Blue HQ.',
    fog: true,
    difficulty: 'normal',
    par: 12,
    tutorial: ghostsTutorial,
    map: {
      name: 'Ghosts in the Reeds',
      grid: [
        'H..ff.cf...w',
        '.f...fff.f.w',
        '..rrrr..f..f',
        'f.f..r.fff..',
        '..ff.rrr..f.',
        '.f....f.rr..',
        'w..fff...r.f',
        'w.f..cff..fH',
      ],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 11, y: 7, owner: 'blue' },
      ],
      units: [
        { type: 'recon', owner: 'red', x: 1, y: 0 },
        { type: 'lightTank', owner: 'red', x: 2, y: 0 },
        { type: 'infantry', owner: 'red', x: 0, y: 1 },
        { type: 'infantry', owner: 'red', x: 2, y: 1 },
        { type: 'bazooka', owner: 'red', x: 3, y: 1 },
        { type: 'bazooka', owner: 'red', x: 1, y: 2 },
        { type: 'artillery', owner: 'red', x: 0, y: 2 },
        { type: 'stealthTank', owner: 'blue', x: 7, y: 3 },
        { type: 'stealthTank', owner: 'blue', x: 8, y: 5 },
        { type: 'infantry', owner: 'blue', x: 10, y: 7 },
        { type: 'infantry', owner: 'blue', x: 9, y: 6 },
        { type: 'artillery', owner: 'blue', x: 10, y: 5 },
      ],
      startingFunds: 0,
    },
  },
  {
    name: 'Fleet in Being',
    tagline: 'Submarines, and the ships that hunt them',
    briefing:
      'Kade’s fleet is at sea: submarines ahead, a destroyer and a cruiser ' +
      'behind them. Submarines stay hidden and only a Frigate can target one. ' +
      'Screen with the Frigate, strike with the Destroyer, and build what you ' +
      'need at your Port. Hold six buildings: the two oil rigs go to whoever ' +
      'rules the sea.',
    fog: false,
    difficulty: 'normal',
    objective: { kind: 'capture', count: 6 },
    par: 14,
    tutorial: fleetTutorial,
    map: {
      name: 'Fleet in Being',
      grid: [
        'HF.swwwwwwwwww',
        '..Pswwwwwwwwww',
        '.c.swwwOwwwwww',
        '...swwwwwwwwww',
        'wwwwwwxxwwwwww',
        'wwwwwwwwwsssss',
        'wwwwwOwwws.c..',
        'wwwwwwwwwsP...',
        'wwwwwwwwwss.FH',
      ],
      properties: [
        { x: 0, y: 0, owner: 'red' },
        { x: 1, y: 0, owner: 'red' },
        { x: 2, y: 1, owner: 'red' },
        { x: 13, y: 8, owner: 'blue' },
        { x: 12, y: 8, owner: 'blue' },
        { x: 10, y: 7, owner: 'blue' },
      ],
      units: [
        { type: 'destroyer', owner: 'red', x: 4, y: 1 },
        { type: 'frigate', owner: 'red', x: 5, y: 2 },
        { type: 'frigate', owner: 'red', x: 5, y: 0 },
        { type: 'cutter', owner: 'red', x: 4, y: 3 },
        { type: 'barge', owner: 'red', x: 3, y: 2 },
        { type: 'infantry', owner: 'red', x: 0, y: 1 },
        { type: 'submarine', owner: 'blue', x: 8, y: 4 },
        { type: 'submarine', owner: 'blue', x: 9, y: 2 },
        { type: 'destroyer', owner: 'blue', x: 8, y: 6 },
        { type: 'infantry', owner: 'blue', x: 12, y: 7 },
      ],
      startingFunds: { red: 10000, blue: 6000 },
    },
  },
  {
    name: 'Cut Off',
    tagline: 'Hold the island against the bombers',
    briefing:
      'Your garrison is alone on the west shore, and Kade has bombers. ' +
      'Bombers wreck anything on the ground and never shoot back; only ' +
      'Anti-Air and Fighters stop them. Two Turrets cover the approaches and ' +
      'repair themselves each turn, and your Airbase can build Fighters. Hold ' +
      'your HQ until day 8.',
    fog: false,
    difficulty: 'normal',
    objective: { kind: 'survive', day: 8 },
    par: 5,
    tutorial: cutOffTutorial,
    map: {
      name: 'Cut Off',
      grid: [
        's..s.www.sAH',
        '.H.f.www..F.',
        '..A..www.c..',
        'c...swwws...',
        '.f..swwws.f.',
        '..c.swwwPs..',
        's...swwws.c.',
        'ss.f.www..f.',
      ],
      properties: [
        { x: 1, y: 1, owner: 'red' },
        { x: 2, y: 2, owner: 'red' },
        { x: 11, y: 0, owner: 'blue' },
        { x: 10, y: 0, owner: 'blue' },
        { x: 10, y: 1, owner: 'blue' },
        { x: 8, y: 5, owner: 'blue' },
      ],
      units: [
        { type: 'turret', owner: 'red', x: 4, y: 2 },
        { type: 'turret', owner: 'red', x: 3, y: 6 },
        { type: 'antiAir', owner: 'red', x: 2, y: 3 },
        { type: 'antiAir', owner: 'red', x: 1, y: 5 },
        { type: 'infantry', owner: 'red', x: 0, y: 1 },
        { type: 'bazooka', owner: 'red', x: 2, y: 1 },
        { type: 'bomber', owner: 'blue', x: 9, y: 3 },
        { type: 'helicopter', owner: 'blue', x: 10, y: 4 },
        { type: 'destroyer', owner: 'blue', x: 6, y: 4 },
        { type: 'lightTank', owner: 'blue', x: 9, y: 1 },
        { type: 'infantry', owner: 'blue', x: 11, y: 2 },
      ],
      startingFunds: { red: 4000, blue: 8000 },
    },
  },
];
