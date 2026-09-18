import type { AiDifficulty } from '../ai/ai';
import { ACTS, MISSIONS, objectiveText } from '../campaign/missions';
import { resetTutorial } from '../campaign/tutorial';
import { decodeMapDef, decodeMatch } from '../engine/serialize';
import type { MapDef } from '../engine/types';
import { CROSSFIRE_VALLEY, SKIRMISH_MAPS } from '../maps';
import { exitApp, initNative, onBackButton } from '../native';
import { GameController, type GameDom } from './controller';
import { MapEditor } from './editor';
import { renderUnitGuide } from './guide';
import {
  campaignProgress,
  loadSave,
  medals,
  resetCampaignProgress,
  starText,
  type SaveGame,
  type SessionConfig,
} from './save';
import { sfx } from './sound';

export const APP_VERSION = '0.3.0';

type ScreenName = 'menu' | 'campaign' | 'skirmish' | 'settings' | 'game';
type Opponent = 'ai' | 'hotseat' | 'pvp';

interface SkirmishPrefs {
  opponent: Opponent;
  difficulty: AiDifficulty;
  fog: boolean;
  /** Name of the chosen built-in map. */
  map: string;
}

const CUSTOM_MAP = '__custom';

const PREFS_KEY = 'crossfire-valley-skirmish';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

function loadPrefs(): SkirmishPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      return {
        opponent: 'ai',
        difficulty: 'normal',
        fog: false,
        map: CROSSFIRE_VALLEY.name,
        ...(JSON.parse(raw) as Partial<SkirmishPrefs>),
      };
    }
  } catch {
    /* fall through to defaults */
  }
  return { opponent: 'ai', difficulty: 'normal', fog: false, map: CROSSFIRE_VALLEY.name };
}

/** Screen flow around the game: menus, campaign select, setup, settings. */
export class App {
  private screens: Record<ScreenName, HTMLElement>;
  private controller: GameController;
  private editor: MapEditor;
  private customMap: MapDef | null = null;
  private prefs = loadPrefs();
  private current: ScreenName = 'menu';

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
      nextUnitBtn: el<HTMLButtonElement>('next-unit-btn'),
      menuBtn: el('menu-btn'),
      pauseMenu: el('pause-menu'),
      pauseResume: el('pause-resume'),
      pauseRestart: el('pause-restart'),
      pauseGuide: el('pause-guide'),
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
      hudGoal: el('hud-goal'),
      dayLabel: el('day-label'),
      turnChip: el('turn-chip'),
      fundsRed: el('funds-red'),
      fundsBlue: el('funds-blue'),
      tileInfo: el('tile-info'),
      unitInfo: el('unit-info'),
    };
    this.controller = new GameController(dom, {
      onQuit: () => this.showMenu(),
      onGuide: () => this.openGuide(),
      onMissionSelect: () => this.showCampaign(),
      onBriefing: (i) => this.showBriefing(i),
    });
    this.editor = new MapEditor((map) => this.playCustomMap(map));

    // Main menu
    el('menu-continue').addEventListener('click', () => this.continueGame());
    el('menu-campaign').addEventListener('click', () => this.showCampaign());
    el('menu-skirmish').addEventListener('click', () => this.showSkirmish());
    el('menu-editor').addEventListener('click', () => this.editor.open());
    el('menu-units').addEventListener('click', () => this.openGuide());
    el('units-close').addEventListener('click', () => el('units-menu').classList.add('hidden'));
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
    el<HTMLSelectElement>('skirmish-map').addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      if (value !== CUSTOM_MAP) {
        this.customMap = null;
        this.prefs.map = value;
        this.savePrefs();
      }
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
      el('settings-status').textContent = 'The tutorial will play again on Missions 1 and 2.';
    });
    el('settings-reset-campaign').addEventListener('click', () => {
      if (!confirm('Reset campaign progress? Completed missions will lock again.')) return;
      resetCampaignProgress();
      el('settings-status').textContent = 'Campaign progress reset.';
    });

    void initNative();
    onBackButton(() => this.back());
  }

  private openGuide(): void {
    renderUnitGuide(el('units-list'));
    el('units-menu').classList.remove('hidden');
  }

  /** Android hardware back button. */
  private back(): void {
    if (!el('units-menu').classList.contains('hidden')) {
      el('units-menu').classList.add('hidden');
      return;
    }
    if (!el('editor').classList.contains('hidden')) {
      el('editor-close').click();
      return;
    }
    switch (this.current) {
      case 'game':
        this.controller.handleBack();
        break;
      case 'campaign':
        if (el('campaign-detail').hidden) this.showMenu();
        else this.showCampaign();
        break;
      case 'menu':
        exitApp();
        break;
      default:
        this.showMenu();
    }
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
    this.current = name;
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
    const best = medals();
    const list = el('campaign-list');
    list.innerHTML = '';
    MISSIONS.forEach((mission, i) => {
      const act = ACTS.find((a) => a.start === i);
      if (act) {
        const h = document.createElement('h3');
        h.className = 'act-title';
        h.textContent = act.title;
        list.appendChild(h);
      }
      const unlocked = i <= progress;
      const done = i < progress;
      const b = document.createElement('button');
      b.className = 'mission-option';
      b.disabled = !unlocked;
      const badge = done ? `<span class="stars">${starText(best[i] ?? 1)}</span>` : unlocked ? '▶' : '🔒';
      b.innerHTML = `<span>${i + 1}. ${mission.name}<small>${unlocked ? mission.tagline : 'Locked'}</small></span><span class="medal">${badge}</span>`;
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
    el('briefing-objective').textContent =
      `${objectiveText(mission)} Enemy commander: ${mission.difficulty}.`;
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
    const select = el<HTMLSelectElement>('skirmish-map');
    select.innerHTML = '';
    for (const map of SKIRMISH_MAPS) {
      const opt = document.createElement('option');
      opt.value = map.name;
      opt.textContent = `${map.name} (${map.grid[0].length}×${map.grid.length})`;
      select.appendChild(opt);
    }
    if (this.customMap) {
      const opt = document.createElement('option');
      opt.value = CUSTOM_MAP;
      opt.textContent = `${this.customMap.name} (custom)`;
      select.appendChild(opt);
    }
    select.value = this.customMap ? CUSTOM_MAP : this.prefs.map;
    if (select.selectedIndex < 0) select.value = SKIRMISH_MAPS[0].name;
    el('skirmish-hint').textContent =
      this.prefs.opponent === 'pvp'
        ? 'Play by link: after each turn you get a link to send your opponent. No account needed.'
        : this.prefs.opponent === 'hotseat'
          ? 'Two players on this device — pass it between turns.'
          : 'You command Red; the computer commands Blue.';
  }

  private startSkirmish(): void {
    const { opponent, difficulty, fog } = this.prefs;
    const builtIn = SKIRMISH_MAPS.find((m) => m.name === this.prefs.map) ?? null;
    const map = this.customMap ?? (builtIn === CROSSFIRE_VALLEY ? null : builtIn);
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
