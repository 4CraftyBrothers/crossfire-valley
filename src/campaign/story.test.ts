import { describe, expect, it } from 'vitest';
import { MISSIONS } from './missions';
import { SPEAKERS, STORY } from './story';

describe('campaign story', () => {
  it('has dialogue before and after every mission', () => {
    expect(STORY).toHaveLength(MISSIONS.length);
    STORY.forEach((s, i) => {
      expect(s.before.length, MISSIONS[i].name).toBeGreaterThanOrEqual(2);
      expect(s.after.length, MISSIONS[i].name).toBeGreaterThanOrEqual(1);
    });
  });

  it('uses known speakers and lines short enough for a phone card', () => {
    for (const s of STORY) {
      for (const line of [...s.before, ...s.after]) {
        expect(SPEAKERS[line.who]).toBeDefined();
        expect(line.text.length, line.text).toBeLessThanOrEqual(130);
      }
    }
  });
});
