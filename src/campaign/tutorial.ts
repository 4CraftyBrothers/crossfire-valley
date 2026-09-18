import { unitById } from '../engine/state';
import type { Command, GameState, Unit } from '../engine/types';

export interface TutorialView {
  state: GameState;
  modeKind: string;
  selectedUnit?: Unit;
  /** Most recent command issued by the human player. */
  lastCommand?: Command;
}

interface Facts {
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
}

export interface TutorialStep {
  text: string;
  highlight?: { x: number; y: number }[];
  done: (facts: Facts) => boolean;
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
  };

  constructor(private steps: TutorialStep[]) {}

  current(view: TutorialView): TutorialPrompt | null {
    this.observe(view);
    while (this.index < this.steps.length) {
      const step = this.steps[this.index];
      if (step.final || !step.done(this.facts)) break;
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
    if (v.modeKind === 'selected' && v.selectedUnit?.type === 'lightTank' && v.selectedUnit.owner === 'red') {
      f.selectedTank = true;
    }
    if (v.modeKind === 'menu' || v.modeKind === 'targeting') f.choseDestination = true;
    if (v.modeKind === 'building') f.openedBuild = true;
    const cmd = v.lastCommand;
    if (!cmd) return;
    if (cmd.kind === 'endTurn') f.endedTurn = true;
    if (cmd.kind === 'build') f.built = true;
    if (cmd.kind === 'move') {
      f.movedAny = true;
      const unit = unitById(v.state, cmd.unitId);
      if (unit?.type === 'lightTank') f.movedTank = true;
      if (unit?.type === 'infantry') f.movedInfantry = true;
      if (cmd.action.type === 'capture') f.captured = true;
      if (cmd.action.type === 'attack') f.attacked = true;
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
      text: 'Now give an order. <b>Hold</b> parks the unit there; <b>Attack</b> appears when an enemy is in reach.',
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
