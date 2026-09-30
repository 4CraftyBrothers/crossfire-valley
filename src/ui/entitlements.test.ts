import { describe, expect, it } from 'vitest';
import { FREE_MISSIONS, missionNeedsUnlock, skirmishNeedsUnlock } from './entitlements';

describe('free tier', () => {
  it('keeps Act I free and gates the rest of the campaign', () => {
    expect(FREE_MISSIONS).toBe(12);
    expect(missionNeedsUnlock(0, false)).toBe(false);
    expect(missionNeedsUnlock(11, false)).toBe(false);
    expect(missionNeedsUnlock(12, false)).toBe(true);
    expect(missionNeedsUnlock(23, true)).toBe(false);
  });

  it('keeps the default map and local two-player free', () => {
    expect(skirmishNeedsUnlock(true, 'ai', false)).toBe(false);
    expect(skirmishNeedsUnlock(true, 'pvp', false)).toBe(false);
    expect(skirmishNeedsUnlock(false, 'hotseat', false)).toBe(false);
    expect(skirmishNeedsUnlock(false, 'ai', false)).toBe(true);
    expect(skirmishNeedsUnlock(false, 'pvp', false)).toBe(true);
    expect(skirmishNeedsUnlock(false, 'ai', true)).toBe(false);
  });
});
