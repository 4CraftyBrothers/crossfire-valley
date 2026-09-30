/** Small player preferences, kept together under one storage key. */
export interface Prefs {
  /** Ask before ending a turn while units can still act. */
  confirmEndTurn: boolean;
}

const KEY = 'crossfire-valley-prefs';
const DEFAULTS: Prefs = { confirmEndTurn: true };

export function getPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getPrefs(), [key]: value }));
  } catch {
    // Storage unavailable (private mode); the default applies next launch.
  }
}
