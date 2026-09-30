import { describe, expect, it } from 'vitest';
import { forecastAttack } from './combat';
import { applyCommand } from './game';
import { createGame, unitById } from './state';
import type { MapDef } from './types';

const MAP: MapDef = {
  name: 'Forecast',
  grid: ['H.....', '..f...', '......', '......', '.....H'],
  properties: [
    { x: 0, y: 0, owner: 'red' },
    { x: 5, y: 4, owner: 'blue' },
  ],
  units: [
    { type: 'lightTank', owner: 'red', x: 0, y: 2 },
    { type: 'infantry', owner: 'blue', x: 3, y: 1 },
    { type: 'artillery', owner: 'red', x: 4, y: 3 },
  ],
  startingFunds: 0,
};

describe('forecastAttack', () => {
  it('matches what the attack actually does, counter included, from the destination tile', () => {
    const s = createGame(MAP);
    const tank = s.units[0];
    const inf = s.units[1];
    const to = { x: 2, y: 1 }; // the forest: the counter hits a tank in cover
    const f = forecastAttack(s, tank, to, inf);
    const r = applyCommand(s, { kind: 'move', unitId: tank.id, to, action: { type: 'attack', targetId: inf.id } });
    expect(100 - (unitById(r.state, inf.id)?.hp ?? 0)).toBe(f.damage);
    expect(100 - unitById(r.state, tank.id)!.hp).toBe(f.counter);
    expect(f.counter).toBeGreaterThan(0);
    expect(f.kills).toBe(false);
  });

  it('reports no counter against indirect fire and a kill when the target drops', () => {
    const s = createGame(MAP);
    const art = s.units[2];
    const inf = s.units[1];
    inf.hp = 10;
    const f = forecastAttack(s, art, { x: art.x, y: art.y }, inf);
    expect(f).toMatchObject({ damage: 10, counter: 0, kills: true, dies: false });
  });
});
