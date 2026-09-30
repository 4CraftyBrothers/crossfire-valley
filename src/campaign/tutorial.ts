import { tileAt, unitById } from '../engine/state';
import type { Command, GameState, Terrain, Unit, UnitType } from '../engine/types';

export interface TutorialView {
  state: GameState;
  modeKind: string;
  selectedUnit?: Unit;
  /** Most recent command issued by the human player. */
  lastCommand?: Command;
}

export interface Facts {
  selectedTank: boolean;
  choseDestination: boolean;
  movedTank: boolean;
  movedInfantry: boolean;
  movedAny: boolean;
  endedTurn: boolean;
  captured: boolean;
  attacked: boolean;
  openedBuild: boolean;
  built: boolean;
  /** Red unit types the player has selected, moved, or attacked with. */
  selected: Set<UnitType>;
  moved: Set<UnitType>;
  attackedWith: Set<UnitType>;
  /** Looked at an enemy's threat range. */
  inspected: boolean;
  /** Boarded a transport / unloaded one / upgraded a property. */
  boarded: boolean;
  unloaded: boolean;
  upgraded: boolean;
}

export interface TutorialStep {
  text: string;
  highlight?: { x: number; y: number }[];
  /** Whether play has satisfied this step; the view allows board checks. */
  done: (facts: Facts, view: TutorialView) => boolean;
  /** The closing step: dismissed by the player rather than by play. */
  final?: boolean;
}

export interface TutorialPrompt {
  text: string;
  highlight: Set<string>;
  final: boolean;
}

/**
 * Guides a mission. Progress is driven by facts observed from play rather
 * than a strict script, so doing things out of order (attacking early,
 * say) still counts.
 */
export class Tutorial {
  private index = 0;
  private facts: Facts = {
    selectedTank: false,
    choseDestination: false,
    movedTank: false,
    movedInfantry: false,
    movedAny: false,
    endedTurn: false,
    captured: false,
    attacked: false,
    openedBuild: false,
    built: false,
    selected: new Set(),
    moved: new Set(),
    attackedWith: new Set(),
    inspected: false,
    boarded: false,
    unloaded: false,
    upgraded: false,
  };

  constructor(private steps: TutorialStep[]) {}

  current(view: TutorialView): TutorialPrompt | null {
    this.observe(view);
    while (this.index < this.steps.length) {
      const step = this.steps[this.index];
      if (step.final || !step.done(this.facts, view)) break;
      this.index++;
    }
    if (this.index >= this.steps.length) return null;
    const step = this.steps[this.index];
    return {
      text: step.text,
      highlight: new Set((step.highlight ?? []).map((p) => `${p.x},${p.y}`)),
      final: step.final === true,
    };
  }

  private observe(v: TutorialView): void {
    const f = this.facts;
    if (v.modeKind === 'selected' && v.selectedUnit?.owner === 'red') {
      f.selected.add(v.selectedUnit.type);
      if (v.selectedUnit.type === 'lightTank') f.selectedTank = true;
    }
    if (v.modeKind === 'menu' || v.modeKind === 'targeting') f.choseDestination = true;
    if (v.modeKind === 'building') f.openedBuild = true;
    if (v.modeKind === 'threat') f.inspected = true;
    const cmd = v.lastCommand;
    if (!cmd) return;
    if (cmd.kind === 'endTurn') f.endedTurn = true;
    if (cmd.kind === 'build') f.built = true;
    if (cmd.kind === 'upgrade') f.upgraded = true;
    if (cmd.kind === 'move') {
      f.movedAny = true;
      // The unit may have died in the exchange; its type is then unknown.
      const unit = unitById(v.state, cmd.unitId);
      if (unit) f.moved.add(unit.type);
      if (unit?.type === 'lightTank') f.movedTank = true;
      if (unit?.type === 'infantry') f.movedInfantry = true;
      if (cmd.action.type === 'capture') f.captured = true;
      if (cmd.action.type === 'load') f.boarded = true;
      if (cmd.action.type === 'unload') f.unloaded = true;
      if (cmd.action.type === 'attack') {
        f.attacked = true;
        if (unit) f.attackedWith.add(unit.type);
      }
    }
  }
}

const TUTORIAL_PREFIX = 'crossfire-valley-tutorial';

export function isTutorialDone(mission: number): boolean {
  // The first release stored a single flag for mission 1.
  if (mission === 0 && localStorage.getItem(TUTORIAL_PREFIX) === '1') return true;
  return localStorage.getItem(`${TUTORIAL_PREFIX}-${mission}`) === '1';
}

export function markTutorialDone(mission: number): void {
  localStorage.setItem(`${TUTORIAL_PREFIX}-${mission}`, '1');
  if (mission === 0) localStorage.setItem(TUTORIAL_PREFIX, '1');
}

export function resetTutorial(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(TUTORIAL_PREFIX)) localStorage.removeItem(key);
  }
}

/** Steps for Mission 1 ("First Steps"); coordinates match its map. */
export function firstStepsTutorial(): TutorialStep[] {
  return [
    {
      text: 'Welcome, Commander. Tap your <b>Light Tank</b> to select it.',
      highlight: [{ x: 3, y: 3 }],
      done: (f) => f.selectedTank || f.movedTank,
    },
    {
      text: 'The blue tiles are where it can move this turn. Tap one to move there.',
      done: (f) => f.choseDestination || f.movedTank,
    },
    {
      text: 'Now give an order. <b>Done</b> ends its move there; <b>Attack</b> appears when an enemy is in reach.',
      done: (f) => f.movedTank,
    },
    {
      text: 'Cities pay <b>$1000</b> a turn. Select an Infantry and move it toward the neutral city. <b>Next</b> jumps to a unit that hasn\'t moved.',
      highlight: [{ x: 3, y: 5 }],
      done: (f) => f.movedInfantry,
    },
    {
      text: 'When your units are done, press <b>End Turn</b>. Blue moves next — watch out.',
      done: (f) => f.endedTurn,
    },
    {
      text: 'To take the city, move a foot unit onto it and choose <b>Capture</b>. A healthy unit needs two turns.',
      highlight: [{ x: 3, y: 5 }],
      done: (f) => f.captured,
    },
    {
      text: 'Move next to a Blue soldier and choose <b>Attack</b>. Tanks crush infantry, and forests shield defenders.',
      done: (f) => f.attacked,
    },
    {
      text: "That's the basics. Destroy both Blue soldiers, or capture their <b>HQ</b>, to win. Good luck!",
      highlight: [{ x: 9, y: 3 }],
      done: () => false,
      final: true,
    },
  ];
}

/** Steps for Mission 2 ("Industrial Might"): factories and income. */
export function industrialMightTutorial(): TutorialStep[] {
  return [
    {
      text: 'You have <b>factories</b> now. Tap an empty one you own to build a unit.',
      highlight: [
        { x: 2, y: 2 },
        { x: 2, y: 4 },
      ],
      done: (f) => f.openedBuild || f.built,
    },
    {
      text: 'Pick <b>Infantry</b> — cheap, and the only kind of unit that can capture. New units act next turn.',
      done: (f) => f.built,
    },
    {
      text: 'Every city, factory and HQ you own pays <b>$1000</b> at the start of your turn. Send infantry to the neutral cities.',
      highlight: [
        { x: 4, y: 1 },
        { x: 4, y: 5 },
      ],
      done: (f) => f.movedInfantry,
    },
    {
      text: 'Press <b>End Turn</b>. Your income arrives, your new unit wakes up, and the factory is free to build again.',
      done: (f) => f.endedTurn,
    },
    {
      text: 'Out-produce Blue: more cities, more income, more units. Then take their <b>HQ</b>.',
      highlight: [{ x: 11, y: 3 }],
      done: () => false,
      final: true,
    },
  ];
}

/** True if some Red unit of this type stands on this kind of terrain. */
function redOn(view: TutorialView, type: UnitType, terrain: Terrain): boolean {
  return view.state.units.some(
    (u) => u.owner === 'red' && u.type === type && tileAt(view.state, u.x, u.y).terrain === terrain,
  );
}

/** Steps for Mission 3 ("Hold the Line"): cover, healing, and surviving. */
export function holdTheLineTutorial(): TutorialStep[] {
  return [
    {
      text: 'No factories here: you win by <b>holding your HQ until day 6</b>. The pill at the top counts the days.',
      highlight: [{ x: 1, y: 3 }],
      done: (f) => f.selected.size > 0 || f.movedAny,
    },
    {
      text: '<b>Bazookas</b> punch through tanks. Move one into a <b>forest</b>, where defenders take far less damage.',
      highlight: [
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 2, y: 4 },
        { x: 2, y: 5 },
      ],
      done: (_f, v) => redOn(v, 'bazooka', 'forest'),
    },
    {
      text: 'Units on your own cities and HQ repair <b>2 HP</b> a turn. Pull hurt units back onto them, then <b>End Turn</b>.',
      highlight: [
        { x: 1, y: 2 },
        { x: 1, y: 3 },
        { x: 1, y: 4 },
      ],
      done: (f) => f.endedTurn,
    },
    {
      text: 'Let Blue come to you. Attackers that hit units in cover take heavy return fire. Hold until <b>day 6</b>.',
      done: () => false,
      final: true,
    },
  ];
}

/** Steps for Mission 4 ("Thunder Ridge"): indirect fire. */
export function thunderRidgeTutorial(): TutorialStep[] {
  return [
    {
      text: '<b>Artillery</b> fires 2–3 tiles away, but <b>not on a turn it moves</b>. Tap your Artillery.',
      highlight: [{ x: 2, y: 4 }],
      done: (f) => f.selected.has('artillery') || f.moved.has('artillery'),
    },
    {
      text: 'Move it toward the passes now so it can fire next turn. Once it is in place, leave it still and choose <b>Attack</b>.',
      done: (f) => f.moved.has('artillery'),
    },
    {
      text: "Blue's guns cover both passes. Artillery can't shoot anything <b>right next to it</b>, so rush them with your <b>Light Tank</b>.",
      highlight: [
        { x: 8, y: 2 },
        { x: 8, y: 6 },
      ],
      done: (f) => f.attacked,
    },
    {
      text: 'Mountains and forests shelter defenders. Break through a pass and take the Blue <b>HQ</b>.',
      highlight: [{ x: 11, y: 4 }],
      done: () => false,
      final: true,
    },
  ];
}

/** Steps for Mission 5 ("Recon in Force"): speed and the capture race. */
export function reconInForceTutorial(): TutorialStep[] {
  return [
    {
      text: '<b>Recon</b> is your fastest unit and sees farthest, but it cannot capture. Send it out to block Blue.',
      highlight: [{ x: 3, y: 2 }],
      done: (f) => f.moved.has('recon'),
    },
    {
      text: 'Only foot units capture. Move <b>Infantry</b> onto a neutral city and choose <b>Capture</b>.',
      highlight: [
        { x: 5, y: 2 },
        { x: 4, y: 4 },
      ],
      done: (f) => f.captured,
    },
    {
      text: 'Your factories build more Infantry. You win by holding <b>8 buildings</b> at once; the pill at the top keeps count.',
      highlight: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
      ],
      done: () => false,
      final: true,
    },
  ];
}

/** Steps for Mission 6 ("Skyfall"): helicopters and anti-air. */
export function skyfallTutorial(): TutorialStep[] {
  return [
    {
      text: 'Blue flies <b>helicopters</b>. They ignore terrain and get no cover from it. Your <b>Anti-Air</b> shreds them.',
      highlight: [{ x: 3, y: 3 }],
      done: (f) => f.selected.has('antiAir') || f.moved.has('antiAir'),
    },
    {
      text: 'Infantry barely scratch aircraft and artillery cannot hit them at all. Keep the Anti-Air close to your army.',
      done: (f) => f.moved.has('antiAir'),
    },
    {
      text: "Your own <b>Helicopter</b> flies over mountains and water. Hunt Blue's tanks with it, but stay clear of their Anti-Air.",
      highlight: [{ x: 2, y: 5 }],
      done: (f) => f.moved.has('helicopter'),
    },
    {
      text: 'Win the air, then take the Blue <b>HQ</b>.',
      highlight: [{ x: 11, y: 3 }],
      done: () => false,
      final: true,
    },
  ];
}
