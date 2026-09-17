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
  endedTurn: boolean;
  captured: boolean;
  attacked: boolean;
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
 * Guides the player through their first mission. Progress is driven by
 * facts observed from play rather than a strict script, so doing things
 * out of order (attacking early, say) still counts.
 */
export class Tutorial {
  private index = 0;
  private facts: Facts = {
    selectedTank: false,
    choseDestination: false,
    movedTank: false,
    movedInfantry: false,
    endedTurn: false,
    captured: false,
    attacked: false,
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
    const cmd = v.lastCommand;
    if (!cmd) return;
    if (cmd.kind === 'endTurn') f.endedTurn = true;
    if (cmd.kind === 'move') {
      const unit = unitById(v.state, cmd.unitId);
      if (unit?.type === 'lightTank') f.movedTank = true;
      if (unit?.type === 'infantry') f.movedInfantry = true;
      if (cmd.action.type === 'capture') f.captured = true;
      if (cmd.action.type === 'attack') f.attacked = true;
    }
  }
}

const TUTORIAL_KEY = 'crossfire-valley-tutorial';

export function isTutorialDone(): boolean {
  return localStorage.getItem(TUTORIAL_KEY) === '1';
}

export function markTutorialDone(): void {
  localStorage.setItem(TUTORIAL_KEY, '1');
}

export function resetTutorial(): void {
  localStorage.removeItem(TUTORIAL_KEY);
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
      text: 'Now give an order. <b>Wait</b> ends its move; <b>Attack</b> appears when an enemy is in reach.',
      done: (f) => f.movedTank,
    },
    {
      text: 'Cities pay <b>$1000</b> a turn. Select an Infantry and move it toward the neutral city.',
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
