/** Small player preferences, kept together under one storage key. */
export interface Prefs {
  /** Ask before ending a turn while units can still act. */
  confirmEndTurn: boolean;
  /** Local two-player: cover the board between turns until the next player is ready. */
  handoff: boolean;
  /** Shape markers on units and buildings, so teams don't rely on colour alone. */
  teamMarkers: boolean;
  /** Bigger type in menus, briefings, hints, and panels. */
  largeText: boolean;
  /** No sliding, shaking, pulsing, or floating numbers. */
  reduceMotion: boolean;
}

const KEY = 'crossfire-valley-prefs';
function systemReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const DEFAULTS: Prefs = {
  confirmEndTurn: true,
  handoff: true,
  teamMarkers: false,
  largeText: false,
  reduceMotion: systemReducedMotion(),
};

/** Mirrors the display preferences onto <html> classes the stylesheet keys off. */
export function applyDisplayPrefs(prefs: Prefs = getPrefs()): void {
  const root = document.documentElement.classList;
  root.toggle('large-text', prefs.largeText);
  root.toggle('reduce-motion', prefs.reduceMotion);
}

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
