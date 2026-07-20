import { describe, expect, it } from 'vitest';
import { CROSSFIRE_VALLEY } from '../maps';
import { MISSIONS } from '../campaign/missions';
import { decodeMapDef, encodeMapDef, validateMapDef } from './serialize';
import type { MapDef } from './types';

describe('map validation and share links', () => {
  it('accepts all shipped maps', () => {
    expect(validateMapDef(CROSSFIRE_VALLEY)).toEqual([]);
    for (const mission of MISSIONS) {
      expect(validateMapDef(mission.map), mission.name).toEqual([]);
    }
  });

  it('round-trips a map through a share code', async () => {
    const code = await encodeMapDef(CROSSFIRE_VALLEY);
    expect(code).toMatch(/^[dr][A-Za-z0-9_-]+$/);
    const back = await decodeMapDef(code);
    expect(back).toEqual(CROSSFIRE_VALLEY);
  });

  it('flags missing HQs, stacked units, and impassable placements', () => {
    const bad: MapDef = {
      name: 'Bad',
      grid: ['w....', '.....', '.....', '.....', '....H'],
      properties: [{ x: 4, y: 4, owner: 'blue' }],
      units: [
        { type: 'lightTank', owner: 'red', x: 0, y: 0 }, // on water
        { type: 'infantry', owner: 'blue', x: 1, y: 1 },
        { type: 'bazooka', owner: 'blue', x: 1, y: 1 }, // stacked
      ],
      startingFunds: 1000,
    };
    const errors = validateMapDef(bad);
    expect(errors.join(' ')).toMatch(/Red needs an HQ/);
    expect(errors.join(' ')).toMatch(/cannot stand on water/);
    expect(errors.join(' ')).toMatch(/share tile/);
  });

  it('rejects malformed grids and garbage codes', async () => {
    expect(validateMapDef({ ...CROSSFIRE_VALLEY, grid: ['abc'] })[0]).toMatch(/unknown terrain/);
    expect(
      validateMapDef({ ...CROSSFIRE_VALLEY, grid: ['....', '...'] })[0],
    ).toMatch(/not .* tiles wide/);
    await expect(decodeMapDef('x999')).rejects.toThrow();
    const tooSmall = await encodeMapDef({
      name: 'tiny',
      grid: ['..', '..'],
      properties: [],
      units: [],
      startingFunds: 0,
    });
    await expect(decodeMapDef(tooSmall)).rejects.toThrow(/Invalid map/);
  });
});
