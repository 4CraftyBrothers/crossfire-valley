import type { AiDifficulty } from '../ai/ai';
import type { GameState, MapDef } from '../engine/types';

export type SessionConfig =
  | { kind: 'campaign'; mission: number }
  | { kind: 'skirmish'; difficulty: AiDifficulty; fog: boolean; map: MapDef | null }
  | { kind: 'hotseat'; fog: boolean; map: MapDef | null }
  | { kind: 'pvp'; fog: boolean; map: MapDef | null };

export interface SaveGame {
  version: 1;
  config: SessionConfig;
  state: GameState;
  savedAt: number;
}

const SAVE_KEY = 'crossfire-valley-save';
// Kept from the first release so existing players don't lose their unlocks.
const PROGRESS_KEY = 'tactics-clash-campaign';

export function loadSave(): SaveGame | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as SaveGame;
    return save.version === 1 && save.state && save.config ? save : null;
  } catch {
    return null;
  }
}

export function writeSave(save: SaveGame): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* storage full or unavailable: the game still plays, it just won't resume */
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/** Number of campaign missions completed. */
export function campaignProgress(): number {
  return parseInt(localStorage.getItem(PROGRESS_KEY) ?? '0', 10) || 0;
}

export function saveCampaignProgress(completed: number): void {
  if (completed > campaignProgress()) localStorage.setItem(PROGRESS_KEY, String(completed));
}

export function resetCampaignProgress(): void {
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(MEDALS_KEY);
}

const MEDALS_KEY = 'crossfire-valley-medals';

/** Best star rating per completed mission index. */
export function medals(): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(MEDALS_KEY) ?? '{}') as Record<number, number>;
  } catch {
    return {};
  }
}

export function recordMedal(mission: number, stars: number): void {
  const all = medals();
  if ((all[mission] ?? 0) >= stars) return;
  all[mission] = stars;
  localStorage.setItem(MEDALS_KEY, JSON.stringify(all));
}

export function starText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
}
