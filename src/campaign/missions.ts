import type { AiDifficulty } from '../ai/ai';
import type { GameState, MapDef, Objective } from '../engine/types';
import { CROSSFIRE_VALLEY, TWIN_RIVERS } from '../maps';

export interface Act {
  title: string;
  /** Index of the act's first mission. */
  start: number;
}

export const ACTS: Act[] = [
  { title: 'Act I — The Valley', start: 0 },
  { title: 'Act II — Counteroffensive', start: 12 },
];

export interface Mission {
  name: string;
  /** Shown on the briefing screen before the mission starts. */
  briefing: string;
  /** One-line teaser for the mission list. */
  tagline: string;
  fog: boolean;
  difficulty: AiDifficulty;
  /** Omitted = capture the enemy HQ or destroy every enemy unit. */
  objective?: Objective;
  /**
   * Medal bar: days to finish for 3 stars, or for 'survive' missions the
   * number of your own units that must still be standing.
   */
  par: number;
  map: MapDef;
}

export function objectiveText(mission: Mission): string {
  const o = mission.objective;
  if (o?.kind === 'survive') return `Hold your HQ until day ${o.day}.`;
  if (o?.kind === 'capture') return `Hold ${o.count} buildings (cities, factories and HQs).`;
  return 'Capture the enemy HQ or destroy every enemy unit.';
}

/** 1-3 stars for a won mission. */
export function missionStars(mission: Mission, state: GameState): number {
  if (mission.objective?.kind === 'survive') {
    const alive = state.units.filter((u) => u.owner === 'red').length;
    return alive >= mission.par ? 3 : alive >= Math.ceil(mission.par / 2) ? 2 : 1;
  }
  return state.day <= mission.par ? 3 : state.day <= mission.par + 3 ? 2 : 1;
}

/** You always command Red; the computer commands Blue. */
export const MISSIONS: Mission[] = [
  {
    name: 'First Steps',
    tagline: 'Learn to move, fight, and capture',
    briefing:
      'A Blue scouting party has crossed the border. Push them back! ' +
      'Tap a unit to see its range, move, then attack when adjacent. ' +
      'Your tank crushes infantry — lead with it, and let your infantry ' +
      'capture the neutral cities for income. Destroy both Blue soldiers ' +
      'or march a foot unit onto their HQ and capture it.',
    fog: false,
    difficulty: 'easy',
    par: 6,
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
      'factories: tap an empty one you own to build. Cities you capture ' +
      'pay $1000 every turn — the income war decides the arms race. ' +
      'Out-produce them, then overrun their HQ.',
    fog: false,
    difficulty: 'easy',
    par: 10,
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
    name: 'Hold the Line',
    tagline: 'Dig in and survive the counterattack',
    briefing:
      'Blue is coming in force and you have no factories — only the ' +
      'ground you stand on. Bazookas punch through tanks; keep them in the ' +
      'forests, where defenders take less damage. Units standing on your ' +
      'buildings heal every turn. Hold your HQ until day 6 and relief ' +
      'will arrive.',
    fog: false,
    difficulty: 'easy',
    objective: { kind: 'survive', day: 6 },
    par: 3,
    map: {
      name: 'Hold the Line',
      grid: [
        'wwm.......mww',
        'w.f.r.....f.w',
        '.cf.r..m..Fc.',
        '.H.rrrrrrr.H.',
        '.cf.r..m..cc.',
        'w.f.r.....f.w',
        'wwm.......mww',
      ],
      properties: [
        { x: 1, y: 3, owner: 'red' },
        { x: 1, y: 2, owner: 'red' },
        { x: 1, y: 4, owner: 'red' },
        { x: 11, y: 3, owner: 'blue' },
        { x: 10, y: 2, owner: 'blue' },
        { x: 11, y: 2, owner: 'blue' },
      ],
      units: [
        // Everyone starts on a building, so the heal-in-place lesson is live.
        { type: 'infantry', owner: 'red', x: 1, y: 3 },
        { type: 'bazooka', owner: 'red', x: 1, y: 2 },
        { type: 'bazooka', owner: 'red', x: 1, y: 4 },
        { type: 'artillery', owner: 'red', x: 0, y: 3 },
        { type: 'lightTank', owner: 'red', x: 2, y: 3 },
        { type: 'lightTank', owner: 'blue', x: 8, y: 3 },
        { type: 'infantry', owner: 'blue', x: 9, y: 4 },
        { type: 'infantry', owner: 'blue', x: 10, y: 3 },
        { type: 'artillery', owner: 'blue', x: 10, y: 1 },
      ],
      startingFunds: { red: 0, blue: 1000 },
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
    difficulty: 'normal',
    par: 12,
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
    name: 'Recon in Force',
    tagline: 'Win the land grab',
    briefing:
      'The plains between the two armies are dotted with undefended towns, ' +
      'and whoever holds them holds the purse. Recon cars are fast on roads ' +
      'but flimsy; infantry captures. Spread out, claim ground, and hold ' +
      'eight buildings at once to secure the region. Blue will be racing ' +
      'you for every one of them.',
    fog: false,
    difficulty: 'normal',
    objective: { kind: 'capture', count: 8 },
    par: 8,
    map: {
      name: 'Recon in Force',
      grid: [
        'wf....c.c....fw',
        '..F.r.....r.F..',
        '.H..rc.m.cr..H.',
        '..F.r..c..r.F..',
        'wf..c.....c..fw',
        '..c...m.m...c..',
        'wff.........ffw',
      ],
      properties: [
        { x: 1, y: 2, owner: 'red' },
        { x: 2, y: 1, owner: 'red' },
        { x: 2, y: 3, owner: 'red' },
        { x: 2, y: 5, owner: 'red' },
        { x: 13, y: 2, owner: 'blue' },
        { x: 12, y: 1, owner: 'blue' },
        { x: 12, y: 3, owner: 'blue' },
        { x: 12, y: 5, owner: 'blue' },
      ],
      units: [
        { type: 'recon', owner: 'red', x: 3, y: 2 },
        { type: 'infantry', owner: 'red', x: 3, y: 1 },
        { type: 'infantry', owner: 'red', x: 3, y: 3 },
        { type: 'lightTank', owner: 'red', x: 4, y: 2 },
        { type: 'recon', owner: 'blue', x: 11, y: 2 },
        { type: 'infantry', owner: 'blue', x: 11, y: 1 },
        { type: 'infantry', owner: 'blue', x: 11, y: 3 },
        { type: 'infantry', owner: 'blue', x: 10, y: 1 },
        { type: 'lightTank', owner: 'blue', x: 10, y: 2 },
      ],
      startingFunds: 3000,
    },
  },
  {
    name: 'Skyfall',
    tagline: 'The air war begins',
    briefing:
      'Blue gunships are raiding across the ridge line. Helicopters ignore ' +
      'terrain — they cross mountains and water and take no cover from it — ' +
      'but only Anti-Air and other helicopters truly threaten them; your ' +
      'artillery cannot touch them at all. Screen your ground forces with ' +
      'the Anti-Air, answer with your own helicopter, and take their HQ.',
    fog: false,
    difficulty: 'normal',
    par: 12,
    map: {
      name: 'Skyfall',
      grid: [
        'w.f..c...f..w',
        '.c...m.m...c.',
        '..F.......F..',
        '.H.r.rrr.r.H.',
        '..F.......F..',
        '.c...m.m...c.',
        'w.f..c...f..w',
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
        { type: 'antiAir', owner: 'red', x: 3, y: 3 },
        { type: 'lightTank', owner: 'red', x: 3, y: 4 },
        { type: 'helicopter', owner: 'red', x: 2, y: 5 },
        { type: 'infantry', owner: 'blue', x: 10, y: 3 },
        { type: 'lightTank', owner: 'blue', x: 9, y: 3 },
        { type: 'helicopter', owner: 'blue', x: 9, y: 2 },
        { type: 'helicopter', owner: 'blue', x: 9, y: 4 },
        { type: 'antiAir', owner: 'blue', x: 10, y: 5 },
      ],
      startingFunds: { red: 8000, blue: 4000 },
    },
  },
  {
    name: 'Iron Tide',
    tagline: 'Heavy armor rolls in',
    briefing:
      "Blue has committed its heavy tanks: slow, expensive, and nearly " +
      "immune to small arms. Don't trade with them one-on-one. Soften them " +
      'with artillery from range, then finish with bazookas — every point ' +
      'of damage a unit takes also weakens its own attacks. Bleed the ' +
      'armor, then take the HQ.',
    fog: false,
    difficulty: 'normal',
    par: 14,
    map: {
      name: 'Iron Tide',
      grid: [
        'w..f.....f..w',
        '.c.F..m..F.c.',
        '..f.rrrrr.f..',
        '.H..r.c.r..H.',
        '..f.rrrrr.f..',
        '.c.F..m..F.c.',
        'w..f.....f..w',
      ],
      properties: [
        { x: 1, y: 3, owner: 'red' },
        { x: 3, y: 1, owner: 'red' },
        { x: 3, y: 5, owner: 'red' },
        { x: 1, y: 1, owner: 'red' },
        { x: 1, y: 5, owner: 'red' },
        { x: 11, y: 3, owner: 'blue' },
        { x: 9, y: 1, owner: 'blue' },
        { x: 9, y: 5, owner: 'blue' },
        { x: 11, y: 1, owner: 'blue' },
        { x: 11, y: 5, owner: 'blue' },
      ],
      units: [
        { type: 'bazooka', owner: 'red', x: 2, y: 2 },
        { type: 'bazooka', owner: 'red', x: 2, y: 4 },
        { type: 'artillery', owner: 'red', x: 2, y: 3 },
        { type: 'lightTank', owner: 'red', x: 4, y: 3 },
        { type: 'infantry', owner: 'red', x: 3, y: 3 },
        { type: 'infantry', owner: 'red', x: 3, y: 2 },
        { type: 'heavyTank', owner: 'blue', x: 8, y: 3 },
        { type: 'lightTank', owner: 'blue', x: 9, y: 2 },
        { type: 'infantry', owner: 'blue', x: 10, y: 3 },
        { type: 'infantry', owner: 'blue', x: 9, y: 3 },
        { type: 'bazooka', owner: 'blue', x: 9, y: 4 },
        { type: 'artillery', owner: 'blue', x: 10, y: 2 },
      ],
      startingFunds: { red: 6000, blue: 6000 },
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
    difficulty: 'normal',
    par: 14,
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
    name: 'River Crossing',
    tagline: 'Two bridges, one army',
    briefing:
      'A river splits the front and only two bridges cross it. Whoever ' +
      'holds a bridgehead controls the flow of the battle — a single unit ' +
      'on a bridge blocks everything behind it. Your helicopter is the ' +
      'exception: it crosses water freely, but Blue has Anti-Air waiting. ' +
      'Force a crossing and take the HQ.',
    fog: false,
    difficulty: 'hard',
    par: 16,
    map: {
      name: 'River Crossing',
      grid: [
        'f.c..f.w.f..c.f',
        '..F..rrrrr..F..',
        '.H...c.w.c...H.',
        '..F..m.w.m..F..',
        '.c...rrrrr...c.',
        '..f..c.w.c..f..',
        'f....f.w.f....f',
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
        { type: 'artillery', owner: 'red', x: 2, y: 2 },
        { type: 'recon', owner: 'red', x: 3, y: 4 },
        { type: 'helicopter', owner: 'red', x: 2, y: 4 },
        { type: 'infantry', owner: 'blue', x: 11, y: 1 },
        { type: 'infantry', owner: 'blue', x: 11, y: 3 },
        { type: 'lightTank', owner: 'blue', x: 10, y: 2 },
        { type: 'artillery', owner: 'blue', x: 12, y: 2 },
        { type: 'recon', owner: 'blue', x: 11, y: 4 },
        { type: 'antiAir', owner: 'blue', x: 12, y: 4 },
      ],
      startingFunds: { red: 5000, blue: 7000 },
    },
  },
  {
    name: 'Night Raid',
    tagline: 'A strike team behind enemy lines',
    briefing:
      'No factories, no reinforcements, no daylight. You are deep in Blue ' +
      'territory with a single strike team, and every city here pays ' +
      'them. Use the fog: stay out of sight, pick off what you can, and ' +
      'sprint for the HQ before their economy buries you. Capturing it ' +
      'ends the war in this sector.',
    fog: true,
    difficulty: 'hard',
    par: 10,
    map: {
      name: 'Night Raid',
      grid: [
        'ww.f.....f.ww',
        'w..m..c..m..w',
        '.f...f.f...F.',
        '.H.rr.c.rr.H.',
        '.f...f.f...F.',
        'w..m..c..m..w',
        'ww.f.....f.ww',
      ],
      properties: [
        { x: 1, y: 3, owner: 'red' },
        { x: 11, y: 3, owner: 'blue' },
        { x: 11, y: 2, owner: 'blue' },
        { x: 11, y: 4, owner: 'blue' },
      ],
      units: [
        { type: 'recon', owner: 'red', x: 2, y: 3 },
        { type: 'lightTank', owner: 'red', x: 3, y: 3 },
        { type: 'bazooka', owner: 'red', x: 2, y: 2 },
        { type: 'infantry', owner: 'red', x: 2, y: 4 },
        { type: 'helicopter', owner: 'red', x: 3, y: 2 },
        { type: 'artillery', owner: 'red', x: 1, y: 2 },
        { type: 'infantry', owner: 'red', x: 1, y: 4 },
        { type: 'infantry', owner: 'blue', x: 10, y: 3 },
        { type: 'infantry', owner: 'blue', x: 9, y: 2 },
        { type: 'lightTank', owner: 'blue', x: 9, y: 3 },
        { type: 'artillery', owner: 'blue', x: 10, y: 2 },
        { type: 'antiAir', owner: 'blue', x: 10, y: 4 },
        { type: 'bazooka', owner: 'blue', x: 7, y: 3 },
      ],
      startingFunds: { red: 0, blue: 2000 },
    },
  },
  {
    name: 'Scorched Earth',
    tagline: 'Outnumbered on a burning front',
    briefing:
      'Blue holds more ground, more money, and a full combined-arms army: ' +
      'heavy armor, artillery, gunships, and Anti-Air. You have a valley ' +
      'and your wits. Take the neutral towns early to close the income ' +
      'gap, pick fights on your terms, and never let their heavy tank ' +
      'reach your factories. Break them here and the valley is open.',
    fog: false,
    difficulty: 'hard',
    par: 18,
    map: {
      name: 'Scorched Earth',
      grid: [
        'wwwf..m.m..fwww',
        'w.c..f.c.f..c.w',
        '..F.r.....r.F..',
        '.H.rr.cmc.rr.H.',
        '..F.r.....r.F..',
        'w.c..f.c.f..c.w',
        '..m....c....m..',
        'wf...c...c...fw',
        'wwf....m....fww',
      ],
      properties: [
        { x: 1, y: 3, owner: 'red' },
        { x: 2, y: 2, owner: 'red' },
        { x: 2, y: 4, owner: 'red' },
        { x: 2, y: 1, owner: 'red' },
        { x: 2, y: 5, owner: 'red' },
        { x: 13, y: 3, owner: 'blue' },
        { x: 12, y: 2, owner: 'blue' },
        { x: 12, y: 4, owner: 'blue' },
        { x: 12, y: 1, owner: 'blue' },
        { x: 12, y: 5, owner: 'blue' },
        { x: 9, y: 7, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 3, y: 2 },
        { type: 'infantry', owner: 'red', x: 3, y: 4 },
        { type: 'lightTank', owner: 'red', x: 4, y: 3 },
        { type: 'artillery', owner: 'red', x: 1, y: 4 },
        { type: 'recon', owner: 'red', x: 3, y: 3 },
        { type: 'bazooka', owner: 'red', x: 3, y: 1 },
        { type: 'infantry', owner: 'blue', x: 11, y: 2 },
        { type: 'infantry', owner: 'blue', x: 11, y: 4 },
        { type: 'lightTank', owner: 'blue', x: 10, y: 3 },
        { type: 'heavyTank', owner: 'blue', x: 11, y: 3 },
        { type: 'artillery', owner: 'blue', x: 13, y: 4 },
        { type: 'antiAir', owner: 'blue', x: 11, y: 1 },
      ],
      startingFunds: { red: 4000, blue: 7000 },
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
    difficulty: 'hard',
    par: 20,
    map: { ...CROSSFIRE_VALLEY, startingFunds: { red: 2000, blue: 6000 } },
  },

  // ----- Act II — Counteroffensive ---------------------------------------
  {
    name: 'Breakout',
    tagline: 'Cross the rivers and claim the far bank',
    briefing:
      'The valley is ours. Now we take the war to them. Two rivers and four ' +
      'bridges lie between you and Blue country, and the towns on the far ' +
      "bank pay whoever gets there first. Blue's war chest is twice yours, " +
      'so this is an income race: hold nine buildings and the front collapses.',
    fog: false,
    difficulty: 'hard',
    objective: { kind: 'capture', count: 9 },
    par: 12,
    map: { ...TWIN_RIVERS, name: 'Breakout', startingFunds: { red: 4000, blue: 5000 } },
  },
  {
    name: 'The Citadel Holds',
    tagline: 'Besieged in the mountains, blind in the fog',
    briefing:
      'Your forward column has been cut off inside a ring of mountains with ' +
      'only two gaps, and Blue is closing in through the fog. There are no ' +
      'reinforcements. Plug the gaps — a bazooka in a mountain pass is worth ' +
      'three in the open — keep your artillery firing from the courtyard, ' +
      'and hold until day 7.',
    fog: true,
    difficulty: 'hard',
    objective: { kind: 'survive', day: 7 },
    par: 3,
    map: {
      name: 'The Citadel Holds',
      grid: [
        'wwf.......fww',
        'w.c.......c.w',
        '.c..mmfmm..c.',
        '....m.H.m....',
        '....mmfmm....',
        '.c...f.f...c.',
        '..r.......r..',
        'w.F..rrr..F.w',
        'wwf..m.m.f.Hw',
      ],
      properties: [
        { x: 6, y: 3, owner: 'red' },
        { x: 11, y: 8, owner: 'blue' },
        { x: 2, y: 7, owner: 'blue' },
        { x: 10, y: 7, owner: 'blue' },
      ],
      units: [
        // Two guns in the courtyard, bazookas in the wooded gaps.
        { type: 'infantry', owner: 'red', x: 6, y: 3 },
        { type: 'bazooka', owner: 'red', x: 6, y: 2 },
        { type: 'bazooka', owner: 'red', x: 6, y: 4 },
        { type: 'artillery', owner: 'red', x: 5, y: 3 },
        { type: 'artillery', owner: 'red', x: 7, y: 3 },
        { type: 'lightTank', owner: 'blue', x: 3, y: 1 },
        { type: 'recon', owner: 'blue', x: 10, y: 3 },
        { type: 'infantry', owner: 'blue', x: 1, y: 3 },
        { type: 'infantry', owner: 'blue', x: 11, y: 3 },
        { type: 'artillery', owner: 'blue', x: 9, y: 6 },
        { type: 'recon', owner: 'blue', x: 3, y: 6 },
        { type: 'bazooka', owner: 'blue', x: 11, y: 8 },
      ],
      startingFunds: { red: 0, blue: 1000 },
    },
  },
  {
    name: 'Dead Zone',
    tagline: 'No towns, no factories — only what you brought',
    briefing:
      'Shelled flat. There is nothing here to capture and nothing to build; ' +
      'both armies fight with what they marched in with. Every trade matters. ' +
      'Let Blue come to you through the forests, focus fire to finish units ' +
      'rather than wounding many, and remember that a unit at half health ' +
      'hits at half strength. Destroy them all, or take their HQ.',
    fog: false,
    difficulty: 'hard',
    par: 10,
    map: {
      name: 'Dead Zone',
      grid: [
        'wwm.f...f.mww',
        'w..f.m.m.f..w',
        '.f...r.r...f.',
        '.H.rrr.rrr.H.',
        '.f...r.r...f.',
        'w..f.m.m.f..w',
        'wwm.f...f.mww',
      ],
      properties: [
        { x: 1, y: 3, owner: 'red' },
        { x: 11, y: 3, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 2, y: 2 },
        { type: 'infantry', owner: 'red', x: 2, y: 4 },
        { type: 'bazooka', owner: 'red', x: 2, y: 3 },
        { type: 'lightTank', owner: 'red', x: 3, y: 3 },
        { type: 'heavyTank', owner: 'red', x: 3, y: 2 },
        { type: 'artillery', owner: 'red', x: 1, y: 2 },
        { type: 'recon', owner: 'red', x: 3, y: 4 },
        { type: 'antiAir', owner: 'red', x: 2, y: 1 },
        { type: 'helicopter', owner: 'red', x: 2, y: 5 },
        { type: 'infantry', owner: 'blue', x: 10, y: 2 },
        { type: 'infantry', owner: 'blue', x: 10, y: 4 },
        { type: 'bazooka', owner: 'blue', x: 10, y: 3 },
        { type: 'lightTank', owner: 'blue', x: 9, y: 3 },
        { type: 'heavyTank', owner: 'blue', x: 9, y: 2 },
        { type: 'artillery', owner: 'blue', x: 11, y: 2 },
        { type: 'recon', owner: 'blue', x: 9, y: 4 },
        { type: 'antiAir', owner: 'blue', x: 10, y: 1 },
        { type: 'helicopter', owner: 'blue', x: 10, y: 5 },
      ],
      startingFunds: 0,
    },
  },
  {
    name: 'Airfield',
    tagline: 'Gunships own the sky — take it back',
    briefing:
      "Blue's forward airfield is launching helicopter raids on your supply " +
      'lines. Gunships shrug off tanks and infantry but die to Anti-Air, and ' +
      'your artillery cannot touch them at all. Keep your Anti-Air screening ' +
      'the front, build more as the money comes in, and push ground forces ' +
      'through once the sky is clear.',
    fog: false,
    difficulty: 'hard',
    par: 14,
    map: {
      name: 'Airfield',
      grid: [
        'w.c..f...f..c.w',
        '..F.....m...F..',
        '.H.rrrr.rrrr.H.',
        '..F..c.m.c..F..',
        '.c...........c.',
        '..f..m...m..f..',
        'w..c...c...c..w',
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
        { type: 'antiAir', owner: 'red', x: 3, y: 2 },
        { type: 'antiAir', owner: 'red', x: 3, y: 3 },
        { type: 'artillery', owner: 'red', x: 2, y: 2 },
        { type: 'infantry', owner: 'red', x: 3, y: 1 },
        { type: 'infantry', owner: 'red', x: 3, y: 4 },
        { type: 'lightTank', owner: 'red', x: 4, y: 2 },
        { type: 'helicopter', owner: 'blue', x: 10, y: 1 },
        { type: 'helicopter', owner: 'blue', x: 10, y: 3 },
        { type: 'helicopter', owner: 'blue', x: 11, y: 2 },
        { type: 'helicopter', owner: 'blue', x: 9, y: 4 },
        { type: 'antiAir', owner: 'blue', x: 11, y: 1 },
        { type: 'infantry', owner: 'blue', x: 11, y: 3 },
        { type: 'lightTank', owner: 'blue', x: 10, y: 2 },
        { type: 'artillery', owner: 'blue', x: 12, y: 2 },
      ],
      startingFunds: { red: 7000, blue: 9000 },
    },
  },
  {
    name: 'Long Winter',
    tagline: 'A wide front, a deep fog, and a richer enemy',
    briefing:
      'The offensive has stalled in a broad, fogged valley where Blue holds ' +
      'more towns than you do. This is the grind: scout with recon, spread ' +
      'infantry to grab every neutral town, hold the forests, and never let ' +
      'a heavy tank reach your factories. Win the income war and the front ' +
      'will move; lose it and the winter is long indeed.',
    fog: true,
    difficulty: 'hard',
    par: 20,
    map: {
      name: 'Long Winter',
      grid: [
        'wwf.m..c..m.fww',
        'w.c.f.....f.c.w',
        '..F.r..m..r.F..',
        '.H.rr.c.c.rr.H.',
        '..F.r..m..r.F..',
        'w.c.f.....f.c.w',
        '..m...c.c...m..',
        '.f..c.....c..f.',
        'w....m.c.m....w',
        'wwf.........fww',
      ],
      properties: [
        { x: 1, y: 3, owner: 'red' },
        { x: 2, y: 2, owner: 'red' },
        { x: 2, y: 4, owner: 'red' },
        { x: 2, y: 1, owner: 'red' },
        { x: 2, y: 5, owner: 'red' },
        { x: 13, y: 3, owner: 'blue' },
        { x: 12, y: 2, owner: 'blue' },
        { x: 12, y: 4, owner: 'blue' },
        { x: 12, y: 1, owner: 'blue' },
        { x: 12, y: 5, owner: 'blue' },
        { x: 8, y: 3, owner: 'blue' },
        { x: 10, y: 7, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 3, y: 2 },
        { type: 'infantry', owner: 'red', x: 3, y: 4 },
        { type: 'bazooka', owner: 'red', x: 3, y: 1 },
        { type: 'lightTank', owner: 'red', x: 4, y: 3 },
        { type: 'artillery', owner: 'red', x: 1, y: 4 },
        { type: 'recon', owner: 'red', x: 3, y: 3 },
        { type: 'antiAir', owner: 'red', x: 1, y: 2 },
        { type: 'infantry', owner: 'blue', x: 11, y: 2 },
        { type: 'infantry', owner: 'blue', x: 11, y: 4 },
        { type: 'lightTank', owner: 'blue', x: 10, y: 3 },
        { type: 'artillery', owner: 'blue', x: 13, y: 4 },
        { type: 'antiAir', owner: 'blue', x: 11, y: 1 },
        { type: 'helicopter', owner: 'blue', x: 12, y: 3 },
        { type: 'recon', owner: 'blue', x: 11, y: 5 },
      ],
      startingFunds: { red: 5000, blue: 9000 },
    },
  },
  {
    name: 'Blue Citadel',
    tagline: 'The last fortress — end the war',
    briefing:
      "This is Blue's capital: an HQ walled in by mountains, factories on " +
      'both flanks, and the whole of their remaining army in front of it. ' +
      'Every lesson applies. Screen against gunships, out-range their guns, ' +
      'use bazookas on the armor, and keep a foot unit alive to walk into ' +
      'that HQ. Take it, Commander, and the war is over.',
    fog: false,
    difficulty: 'hard',
    par: 22,
    map: {
      name: 'Blue Citadel',
      grid: [
        'wwf....c..mmmww',
        '.c..f....m.cFmw',
        '..F.r....m...m.',
        '.H.rr.c.rr.mHm.',
        '..F.r....m...m.',
        '.c..f....m.cFmw',
        'wwf....c..mmmww',
      ],
      properties: [
        { x: 1, y: 3, owner: 'red' },
        { x: 2, y: 2, owner: 'red' },
        { x: 2, y: 4, owner: 'red' },
        { x: 1, y: 1, owner: 'red' },
        { x: 1, y: 5, owner: 'red' },
        { x: 12, y: 3, owner: 'blue' },
        { x: 12, y: 1, owner: 'blue' },
        { x: 12, y: 5, owner: 'blue' },
        { x: 11, y: 1, owner: 'blue' },
        { x: 11, y: 5, owner: 'blue' },
        { x: 7, y: 0, owner: 'blue' },
        { x: 7, y: 6, owner: 'blue' },
      ],
      units: [
        { type: 'infantry', owner: 'red', x: 3, y: 2 },
        { type: 'infantry', owner: 'red', x: 3, y: 4 },
        { type: 'bazooka', owner: 'red', x: 3, y: 1 },
        { type: 'lightTank', owner: 'red', x: 4, y: 3 },
        { type: 'heavyTank', owner: 'red', x: 3, y: 3 },
        { type: 'artillery', owner: 'red', x: 1, y: 2 },
        { type: 'recon', owner: 'red', x: 2, y: 3 },
        { type: 'antiAir', owner: 'red', x: 2, y: 1 },
        { type: 'helicopter', owner: 'red', x: 2, y: 5 },
        { type: 'infantry', owner: 'blue', x: 10, y: 2 },
        { type: 'infantry', owner: 'blue', x: 10, y: 4 },
        { type: 'bazooka', owner: 'blue', x: 11, y: 2 },
        { type: 'bazooka', owner: 'blue', x: 11, y: 4 },
        { type: 'heavyTank', owner: 'blue', x: 9, y: 3 },
        { type: 'lightTank', owner: 'blue', x: 8, y: 3 },
        { type: 'artillery', owner: 'blue', x: 12, y: 2 },
        { type: 'artillery', owner: 'blue', x: 12, y: 4 },
        { type: 'antiAir', owner: 'blue', x: 10, y: 3 },
        { type: 'helicopter', owner: 'blue', x: 14, y: 3 },
      ],
      startingFunds: { red: 8000, blue: 12000 },
    },
  },
];
