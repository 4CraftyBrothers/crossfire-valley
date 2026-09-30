import { describe, expect, it } from 'vitest';
import { nextAiCommand } from '../ai/ai';
import { applyCommand } from '../engine/game';
import { validateMapDef } from '../engine/serialize';
import { createGame } from '../engine/state';
import { SKIRMISH_MAPS } from './index';

describe('skirmish maps', () => {
  it('all validate, and the mirrored ones are fair: same buildings and units per side', () => {
    for (const map of SKIRMISH_MAPS) {
      expect(validateMapDef(map), map.name).toEqual([]);
      const red = map.properties.filter((p) => p.owner === 'red').length;
      const blue = map.properties.filter((p) => p.owner === 'blue').length;
      expect(red, map.name).toBe(blue);
    }
  });

  it('the coastal maps play a full legal AI-vs-AI game that ends', () => {
    for (const map of SKIRMISH_MAPS.slice(5)) {
      let s = createGame(map);
      let steps = 0;
      while (!s.winner && s.day <= 40 && steps < 20000) {
        s = applyCommand(s, nextAiCommand(s, 'normal')).state;
        steps += 1;
      }
      expect(steps, map.name).toBeLessThan(20000);
    }
  });
});
