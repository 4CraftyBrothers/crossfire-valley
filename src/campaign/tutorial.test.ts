import { describe, expect, it } from 'vitest';
import { applyCommand } from '../engine/game';
import { reachableTiles } from '../engine/movement';
import { createGame, unitAt } from '../engine/state';
import type { Command, GameState, UnitType } from '../engine/types';
import { MISSIONS } from './missions';
import { Tutorial, type TutorialView } from './tutorial';

describe('mission tutorials', () => {
  it('missions 1-6 each have one, ending in a final step', () => {
    for (let i = 0; i < 6; i++) {
      const steps = MISSIONS[i].tutorial?.();
      expect(steps, MISSIONS[i].name).toBeDefined();
      expect(steps!.at(-1)!.final, MISSIONS[i].name).toBe(true);
    }
  });

  it('highlights only tiles that exist on the mission map', () => {
    for (const m of MISSIONS) {
      if (!m.tutorial) continue;
      const w = m.map.grid[0].length;
      const h = m.map.grid.length;
      for (const step of m.tutorial()) {
        for (const p of step.highlight ?? []) {
          expect(p.x >= 0 && p.x < w && p.y >= 0 && p.y < h, `${m.name} ${p.x},${p.y}`).toBe(true);
        }
      }
    }
  });
});

/** Drives a mission's tutorial the way the controller does. */
function harness(mission: number) {
  const m = MISSIONS[mission];
  let state: GameState = createGame(m.map, { objective: m.objective });
  const t = new Tutorial(m.tutorial!());
  let last: Command | undefined;
  const view = (extra: Partial<TutorialView> = {}): TutorialView => ({
    state,
    modeKind: 'idle',
    lastCommand: last,
    ...extra,
  });
  const red = (type: UnitType) => state.units.find((u) => u.owner === 'red' && u.type === type)!;
  return {
    text: (extra?: Partial<TutorialView>) => t.current(view(extra))?.text ?? '',
    select: (type: UnitType) => t.current(view({ modeKind: 'selected', selectedUnit: red(type) })),
    run: (cmd: Command) => {
      state = applyCommand(state, cmd).state;
      last = cmd;
      t.current(view());
    },
    red,
    /** Moves the first Red unit of a type to any other free tile it can reach. */
    step: (type: UnitType) => {
      const u = red(type);
      const to = [...reachableTiles(state, u).keys()]
        .map((k) => k.split(',').map(Number))
        .find(([x, y]) => (x !== u.x || y !== u.y) && !unitAt(state, x, y))!;
      state = applyCommand(state, { kind: 'move', unitId: u.id, to: { x: to[0], y: to[1] }, action: { type: 'wait' } }).state;
      last = { kind: 'move', unitId: u.id, to: { x: to[0], y: to[1] }, action: { type: 'wait' } };
      t.current(view());
    },
  };
}

describe('tutorial progress', () => {
  it('Hold the Line advances once a bazooka stands in a forest', () => {
    const h = harness(2);
    expect(h.text()).toContain('day 6');
    h.select('bazooka');
    expect(h.text()).toContain('forest');
    const b = h.red('bazooka');
    h.run({ kind: 'move', unitId: b.id, to: { x: 2, y: b.y }, action: { type: 'wait' } });
    expect(h.text()).toContain('repair');
    h.run({ kind: 'endTurn' });
    expect(h.text()).toContain('Let Blue come to you');
  });

  it('Thunder Ridge teaches selecting, then moving, the artillery', () => {
    const h = harness(3);
    expect(h.text()).toContain('Artillery');
    h.select('artillery');
    expect(h.text()).toContain('toward the passes');
    h.step('artillery');
    expect(h.text()).toContain('rush them');
  });

  it('Recon in Force moves from the recon to capturing', () => {
    const h = harness(4);
    expect(h.text()).toContain('Recon');
    h.step('recon');
    expect(h.text()).toContain('Capture');
  });

  it('Skyfall walks through anti-air and the helicopter', () => {
    const h = harness(5);
    expect(h.text()).toContain('Anti-Air');
    h.step('antiAir');
    expect(h.text()).toContain('Helicopter');
    h.step('helicopter');
    expect(h.text()).toContain('HQ');
  });
});
