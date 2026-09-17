import type { AiDifficulty } from '../ai/ai';
import { MISSIONS } from '../campaign/missions';
import { resetTutorial } from '../campaign/tutorial';
import { decodeMapDef, decodeMatch } from '../engine/serialize';
import type { MapDef } from '../engine/types';
import { CROSSFIRE_VALLEY } from '../maps';
import { GameController, type GameDom } from './controller';
import { MapEditor } from './editor';
import { campaignProgress, loadSave, resetCampaignProgress, type SaveGame, type SessionConfig } from './save';
import { sfx } from './sound';

export const APP_VERSION = '0.2.0';

type ScreenName = 'menu' | 'campaign' | 'skirmish' | 'settings' | 'game';
type Opponent = 'ai' | 'hotseat' | 'pvp';

interface SkirmishPrefs {
  opponent: Opponent;
  difficulty: AiDifficulty;
  fog: boolean;
}

const PREFS_KEY = 'crossfire-valley-skirmish';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

function loadPrefs(): SkirmishPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { opponent: 'ai', difficulty: 'normal', fog: false, ...(JSON.parse(raw) as Partial<SkirmishPrefs>) };
  } catch {
    /* fall through to defaults */
  }
  return { opponent: 'ai', difficulty: 'normal', fog: false };
}

/** Screen flow around the game: menus, campaign select, setup, settings. */
export class App {
  private screens: Record<ScreenName, HTMLElement>;
  private controller: GameController;
  private editor: MapEditor;
  private customMap: MapDef | null = null;
  private prefs = loadPrefs();

  constructor() {
    this.screens = {
      menu: el('screen-menu'),
      campaign: el('screen-campaign'),
      skirmish: el('screen-skirmish'),
      settings: el('screen-settings'),
      game: el('screen-game'),
    };

    const dom: GameDom = {
      viewport: el('viewport'),
      boardWrap: el('board-wrap'),
      canvas: el<HTMLCanvasElement>('board'),
      actionMenu: el('action-menu'),
      banner: el('banner'),
      tutorial: el('tutorial'),
      tutorialText: el('tutorial-text'),
      tutorialSkip: el('tutorial-skip'),
      buildMenu: el('build-menu'),
      buildOptions: el('build-options'),
      buildCancel: el('build-cancel'),
      endTurnBtn: el<HTMLButtonElement>('end-turn-btn'),
      undoBtn: el<HTMLButtonElement>('undo-btn'),
      menuBtn: el('menu-btn'),
      pauseMenu: el('pause-menu'),
      pauseResume: el('pause-resume'),
      pauseRestart: el('pause-restart'),
      pauseSound: el('pause-sound'),
      pauseQuit: el('pause-quit'),
      resultsMenu: el('results-menu'),
      resultsContent: el('results-content'),
      shareMenu: el('share-menu'),
      shareTitle: el('share-title'),
      shareLink: el<HTMLInputElement>('share-link'),
      shareCopy: el('share-copy'),
      shareClose: el('share-close'),
      hudTitle: el('hud-title'),
      dayLabel: el('day-label'),
      turnChip: el('turn-chip'),
      fundsRed: el('funds-red'),
      fundsBlue: el('funds-blue'),
      tileInfo: el('tile-info'),
      unitInfo: el('unit-info'),
    };
    this.controller = new GameController(dom, {
      onQuit: () => this.showMenu(),
      onMissionSelect: () => this.showCampaign(),
      onBriefing: (i) => this.showBriefing(i),
    });
    this.editor = new MapEditor((map) => this.playCustomMap(map));

    // Main menu
    el('menu-continue').addEventListener('click', () => this.continueGame());
    el('menu-campaign').addEventListener('click', () => this.showCampaign());
    el('menu-skirmish').addEventListener('click', () => this.showSkirmish());
    el('menu-editor').addEventListener('click', () => this.editor.open());
    el('menu-settings').addEventListener('click', () => this.showSettings());
    el('menu-version').textContent = `v${APP_VERSION}`;

    // Campaign
    el('campaign-back').addEventListener('click', () => this.showMenu());
    el('briefing-back').addEventListener('click', () => this.showCampaign());

    // Skirmish setup
    el('skirmish-back').addEventListener('click', () => this.showMenu());
    for (const b of el('opponent-group').querySelectorAll<HTMLButtonElement>('button')) {
      b.addEventListener('click', () => {
        this.prefs.opponent = b.dataset.opponent as Opponent;
        this.savePrefs();
        this.reflectSkirmish();
      });
    }
    for (const b of el('difficulty-group').querySelectorAll<HTMLButtonElement>('button')) {
      b.addEventListener('click', () => {
        this.prefs.difficulty = b.dataset.difficulty as AiDifficulty;
        this.savePrefs();
        this.reflectSkirmish();
      });
    }
    el<HTMLInputElement>('skirmish-fog').addEventListener('change', (e) => {
      this.prefs.fog = (e.target as HTMLInputElement).checked;
      this.savePrefs();
    });
    el('skirmish-map-default').addEventListener('click', () => {
      this.customMap = null;
      this.reflectSkirmish();
    });
    el('skirmish-editor').addEventListener('click', () => this.editor.open());
    el('skirmish-start').addEventListener('click', () => this.startSkirmish());

    // Settings
    el('settings-back').addEventListener('click', () => this.showMenu());
    el<HTMLInputElement>('settings-sound').addEventListener('change', (e) => {
      const on = (e.target as HTMLInputElement).checked;
      if (on === sfx.muted) sfx.toggleMuted();
    });
    el('settings-tutorial').addEventListener('click', () => {
      resetTutorial();
      el('settings-status').textContent = 'The tutorial will play again on Mission 1.';
    });
    el('settings-reset-campaign').addEventListener('click', () => {
      if (!confirm('Reset campaign progress? Completed missions will lock again.')) return;
      resetCampaignProgress();
      el('settings-status').textContent = 'Campaign progress reset.';
    });
  }

  async boot(): Promise<void> {
    const matchLink = location.hash.match(/^#m=([A-Za-z0-9_-]+)$/);
    const mapLink = location.hash.match(/^#map=([A-Za-z0-9_-]+)$/);
    if (matchLink) {
      try {
        const payload = await decodeMatch(matchLink[1]);
        this.show('game');
        this.controller.joinMatch(payload);
        return;
      } catch (err) {
        console.error('Could not read match link:', err);
        alert('This match link is invalid or from an incompatible version.');
        history.replaceState(null, '', location.pathname + location.search);
      }
    } else if (mapLink) {
      try {
        this.setCustomMap(await decodeMapDef(mapLink[1]));
        this.showSkirmish();
        return;
      } catch (err) {
        console.error('Could not read map link:', err);
        alert('This map link is invalid.');
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
    this.showMenu();
  }

  private show(name: ScreenName): void {
    for (const [k, node] of Object.entries(this.screens)) node.classList.toggle('active', k === name);
  }

  // ----- main menu -------------------------------------------------------

  private showMenu(): void {
    const save = loadSave();
    const btn = el('menu-continue');
    btn.hidden = !save;
    if (save) el('menu-continue-sub').textContent = describeSave(save);
    this.show('menu');
  }

  private continueGame(): void {
    const save = loadSave();
    if (!save) {
      this.showMenu();
      return;
    }
    this.show('game');
    this.controller.resume(save);
  }

  // ----- campaign --------------------------------------------------------

  private showCampaign(): void {
    const progress = campaignProgress();
    const list = el('campaign-list');
    list.innerHTML = '';
    MISSIONS.forEach((mission, i) => {
      const unlocked = i <= progress;
      const done = i < progress;
      const b = document.createElement('button');
      b.className = 'mission-option';
      b.disabled = !unlocked;
      b.innerHTML = `<span>${i + 1}. ${mission.name}<small>${unlocked ? mission.tagline : 'Locked'}</small></span><span class="medal">${done ? '⭐' : unlocked ? '▶' : '🔒'}</span>`;
      if (unlocked) b.addEventListener('click', () => this.showBriefing(i));
      list.appendChild(b);
    });
    el('campaign-progress').textContent =
      progress >= MISSIONS.length ? 'Campaign complete' : `${progress} of ${MISSIONS.length} missions complete`;
    el('campaign-detail').hidden = true;
    list.hidden = false;
    this.show('campaign');
  }

  private showBriefing(index: number): void {
    const mission = MISSIONS[index];
    el('briefing-title').textContent = `Mission ${index + 1}: ${mission.name}`;
    el('briefing-text').textContent = mission.briefing;
    el('briefing-fog').hidden = !mission.fog;
    const start = el('briefing-start');
    const fresh = start.cloneNode(true) as HTMLElement; // drop the previous mission's listener
    start.replaceWith(fresh);
    fresh.addEventListener('click', () => {
      this.show('game');
      this.controller.launchMission(index);
    });
    el('campaign-list').hidden = true;
    el('campaign-detail').hidden = false;
    this.show('campaign');
  }

  // ----- skirmish --------------------------------------------------------

  private showSkirmish(): void {
    this.reflectSkirmish();
    this.show('skirmish');
  }

  private reflectSkirmish(): void {
    for (const b of el('opponent-group').querySelectorAll<HTMLButtonElement>('button')) {
      b.classList.toggle('active', b.dataset.opponent === this.prefs.opponent);
    }
    for (const b of el('difficulty-group').querySelectorAll<HTMLButtonElement>('button')) {
      b.classList.toggle('active', b.dataset.difficulty === this.prefs.difficulty);
    }
    el('difficulty-field').hidden = this.prefs.opponent !== 'ai';
    el<HTMLInputElement>('skirmish-fog').checked = this.prefs.fog;
    el('skirmish-map-name').textContent = this.customMap ? `${this.customMap.name} (custom)` : CROSSFIRE_VALLEY.name;
    el('skirmish-map-default').hidden = !this.customMap;
    el('skirmish-hint').textContent =
      this.prefs.opponent === 'pvp'
        ? 'Play by link: after each turn you get a link to send your opponent. No account needed.'
        : this.prefs.opponent === 'hotseat'
          ? 'Two players on this device — pass it between turns.'
          : 'You command Red; the computer commands Blue.';
  }

  private startSkirmish(): void {
    const { opponent, difficulty, fog } = this.prefs;
    const map = this.customMap;
    const config: SessionConfig =
      opponent === 'ai'
        ? { kind: 'skirmish', difficulty, fog, map }
        : opponent === 'hotseat'
          ? { kind: 'hotseat', fog, map }
          : { kind: 'pvp', fog, map };
    this.show('game');
    this.controller.startSession(config);
  }

  private playCustomMap(map: MapDef): void {
    this.setCustomMap(map);
    this.startSkirmish();
  }

  private setCustomMap(map: MapDef): void {
    this.customMap = map;
    this.editor.loadMap(map);
  }

  private savePrefs(): void {
    localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
  }

  // ----- settings --------------------------------------------------------

  private showSettings(): void {
    el<HTMLInputElement>('settings-sound').checked = !sfx.muted;
    el('settings-status').textContent = '';
    el('settings-version').textContent = `Crossfire Valley v${APP_VERSION}`;
    this.show('settings');
  }
}

function describeSave(save: SaveGame): string {
  const c = save.config;
  const day = `day ${save.state.day}`;
  if (c.kind === 'campaign') return `Mission ${c.mission + 1}: ${MISSIONS[c.mission].name} — ${day}`;
  const map = (c.map ?? CROSSFIRE_VALLEY).name;
  if (c.kind === 'skirmish') return `${map} vs Computer (${c.difficulty}) — ${day}`;
  return `${map}, local 2P — ${day}`;
}
