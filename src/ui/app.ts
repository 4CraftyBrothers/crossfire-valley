import type { AiDifficulty } from '../ai/ai';
import { ACTS, MISSIONS, objectiveText } from '../campaign/missions';
import { renderCampaignMap, type MapNode } from './campaignMap';
import { LESSONS, lessonsDone } from '../campaign/bootcamp';
import { STORY } from '../campaign/story';
import { renderStory } from './storyView';
import {
  buyUnlock,
  devToggleAvailable,
  devUnlocked,
  isUnlocked,
  loadStore,
  missionNeedsUnlock,
  refreshUnlock,
  restoreUnlock,
  setDevUnlock,
  skirmishNeedsUnlock,
} from './entitlements';
import { resetTutorial } from '../campaign/tutorial';
import { getPrefs, setPref } from './prefs';
import { decodeMapDef, decodeMatch } from '../engine/serialize';
import type { MapDef } from '../engine/types';
import { CROSSFIRE_VALLEY, SKIRMISH_MAPS } from '../maps';
import { exitApp, initNative, onBackButton } from '../native';
import { GameController, type GameDom } from './controller';
import { MapEditor } from './editor';
import { renderUnitGuide } from './guide';
import {
  campaignProgress,
  hardClears,
  loadSave,
  medals,
  resetCampaignProgress,
  starText,
  type SaveGame,
  type SessionConfig,
} from './save';
import { sfx } from './sound';

export const APP_VERSION = '0.3.0';

type ScreenName = 'menu' | 'campaign' | 'bootcamp' | 'skirmish' | 'settings' | 'unlock' | 'game';
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
  private campaignView: 'map' | 'list' = 'map';
  private briefingDifficulty: AiDifficulty = 'normal';
  private current: ScreenName = 'menu';

  constructor() {
    this.screens = {
      menu: el('screen-menu'),
      campaign: el('screen-campaign'),
      bootcamp: el('screen-bootcamp'),
      unlock: el('screen-unlock'),
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
      endTurnMenu: el('endturn-menu'),
      handoff: el('handoff'),
      handoffTitle: el('handoff-title'),
      handoffSub: el('handoff-sub'),
      handoffReady: el('handoff-ready'),
      endTurnText: el('endturn-text'),
      endTurnConfirm: el('endturn-confirm'),
      endTurnNext: el('endturn-next'),
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
      onBootCamp: () => this.showBootCamp(),
    });
    this.editor = new MapEditor(
      (map) => this.playCustomMap(map),
      () => {
        if (isUnlocked()) return true;
        el('editor').classList.add('hidden');
        this.showUnlock(() => this.showMenu());
        return false;
      },
    );

    // Main menu
    el('menu-continue').addEventListener('click', () => this.continueGame());
    el('menu-campaign').addEventListener('click', () => this.showCampaign());
    el('menu-bootcamp').addEventListener('click', () => this.showBootCamp());
    el('bootcamp-back').addEventListener('click', () => this.showMenu());
    el('unlock-back').addEventListener('click', () => this.unlockReturn());
    el('unlock-restore').addEventListener('click', () => void this.restore(el('unlock-status')));
    el('settings-unlock').addEventListener('click', () => this.showUnlock(() => this.showSettings()));
    el('settings-restore').addEventListener('click', () => void this.restore(el('settings-status')));
    el<HTMLInputElement>('settings-dev-unlock').addEventListener('change', (e) => {
      setDevUnlock((e.target as HTMLInputElement).checked);
      this.reflectUnlockSetting();
    });
    el('menu-skirmish').addEventListener('click', () => this.showSkirmish());
    el('menu-editor').addEventListener('click', () => this.editor.open());
    el('menu-units').addEventListener('click', () => this.openGuide());
    el('units-close').addEventListener('click', () => el('units-menu').classList.add('hidden'));
    el('menu-settings').addEventListener('click', () => this.showSettings());
    el('menu-version').textContent = `v${APP_VERSION}`;

    // Campaign
    el('campaign-back').addEventListener('click', () => this.showMenu());
    el('briefing-back').addEventListener('click', () => this.showCampaign());
    el('campaign-view-toggle').addEventListener('click', () => {
      this.campaignView = this.campaignView === 'map' ? 'list' : 'map';
      this.showCampaign();
    });
    for (const b of el('briefing-difficulty').querySelectorAll<HTMLButtonElement>('button')) {
      b.addEventListener('click', () => {
        this.briefingDifficulty = b.dataset.difficulty as AiDifficulty;
        this.reflectBriefingDifficulty();
      });
    }

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
    el<HTMLInputElement>('settings-volume').addEventListener('input', (e) => {
      sfx.setVolume(Number((e.target as HTMLInputElement).value) / 100);
    });
    // A sample so the level can be judged.
    el<HTMLInputElement>('settings-volume').addEventListener('change', () => sfx.select('lightTank'));
    el<HTMLInputElement>('settings-ambient').addEventListener('change', (e) => {
      sfx.setAmbient((e.target as HTMLInputElement).checked);
    });
    el<HTMLInputElement>('settings-sound').addEventListener('change', (e) => {
      const on = (e.target as HTMLInputElement).checked;
      if (on === sfx.muted) sfx.toggleMuted();
    });
    el<HTMLInputElement>('settings-handoff').addEventListener('change', (e) => {
      setPref('handoff', (e.target as HTMLInputElement).checked);
    });
    el<HTMLInputElement>('settings-confirm-end').addEventListener('change', (e) => {
      setPref('confirmEndTurn', (e.target as HTMLInputElement).checked);
    });
    el('settings-tutorial').addEventListener('click', () => {
      resetTutorial();
      el('settings-status').textContent = 'The tutorial will play again on Missions 1–6.';
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
      case 'unlock':
        this.unlockReturn();
        break;
      default:
        this.showMenu();
    }
  }

  async boot(): Promise<void> {
    void refreshUnlock();
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
    sfx.inGame(name === 'game');
    for (const [k, node] of Object.entries(this.screens)) node.classList.toggle('active', k === name);
  }

  // ----- main menu -------------------------------------------------------

  private showMenu(): void {
    const save = loadSave();
    const btn = el('menu-continue');
    btn.hidden = !save;
    if (save) el('menu-continue-sub').textContent = describeSave(save);
    // First launch: point new players at Boot Camp.
    const lessons = lessonsDone().size;
    const fresh = lessons === 0 && campaignProgress() === 0 && !save;
    el('menu-bootcamp').classList.toggle('nudge', fresh);
    el('menu-bootcamp-sub').textContent = fresh
      ? 'New here? Seven quick lessons, about 10 minutes'
      : lessons >= LESSONS.length
        ? 'Complete ★'
        : `${lessons} of ${LESSONS.length} lessons done`;
    this.show('menu');
  }

  private reflectUnlockSetting(): void {
    el('settings-dev-row').hidden = !devToggleAvailable;
    el<HTMLInputElement>('settings-dev-unlock').checked = devUnlocked();
    const owned = isUnlocked();
    el('settings-unlock-sub').textContent = owned ? 'Unlocked. Thank you!' : 'Acts II–III, every map, and sharing';
    el('settings-restore').hidden = owned;
  }

  // ----- full-game unlock ------------------------------------------------

  private unlockReturn: () => void = () => this.showMenu();

  private showUnlock(returnTo: () => void): void {
    this.unlockReturn = returnTo;
    el('unlock-status').textContent = '';
    const buy = el<HTMLButtonElement>('unlock-buy');
    const fresh = buy.cloneNode(true) as HTMLButtonElement; // drop old listeners
    buy.replaceWith(fresh);
    this.show('unlock');
    if (isUnlocked()) {
      fresh.disabled = true;
      fresh.textContent = 'Unlocked. Thank you!';
      return;
    }
    fresh.disabled = true;
    fresh.textContent = 'Checking the store…';
    void loadStore().then((store) => {
      if (store.status !== 'ready') {
        fresh.textContent = 'Not available yet';
        el('unlock-status').textContent = store.reason;
        return;
      }
      fresh.disabled = false;
      fresh.textContent = `Unlock for ${store.price}`;
      fresh.addEventListener('click', async () => {
        fresh.disabled = true;
        el('unlock-status').textContent = 'Waiting for the store…';
        if (await buyUnlock(store.pkg)) {
          el('unlock-status').textContent = 'Unlocked. Thank you!';
          fresh.textContent = 'Unlocked. Thank you!';
          window.setTimeout(() => this.unlockReturn(), 900);
        } else {
          fresh.disabled = false;
          el('unlock-status').textContent = 'The purchase did not go through. You have not been charged.';
        }
      });
    });
  }

  private async restore(status: HTMLElement): Promise<void> {
    status.textContent = 'Checking…';
    if (await restoreUnlock()) {
      status.textContent = 'Full game restored. Thank you!';
      this.reflectUnlockSetting();
    } else {
      const store = await loadStore();
      status.textContent = store.status === 'ready' ? 'No previous purchase found on this account.' : store.reason;
    }
  }

  private showBootCamp(): void {
    const done = lessonsDone();
    const list = el('bootcamp-list');
    list.innerHTML = '';
    LESSONS.forEach((lesson, i) => {
      const b = document.createElement('button');
      b.className = 'mission-option';
      b.dataset.lesson = String(i);
      const name = document.createElement('span');
      name.textContent = `${i + 1}. ${lesson.name}`;
      const small = document.createElement('small');
      small.textContent = lesson.blurb;
      name.append(small);
      const badge = document.createElement('span');
      badge.className = 'medal';
      badge.textContent = done.has(i) ? '✔' : '▶';
      b.append(name, badge);
      b.addEventListener('click', () => {
        this.show('game');
        this.controller.startSession({ kind: 'bootcamp', lesson: i });
      });
      list.appendChild(b);
    });
    el('bootcamp-progress').textContent =
      done.size >= LESSONS.length
        ? 'Boot Camp complete. Replay any lesson whenever you like.'
        : 'Short lessons on tiny maps, with hints all the way. Play them in any order.';
    this.show('bootcamp');
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
    const hard = hardClears();
    const unlocked = isUnlocked();
    const nodes: MapNode[] = MISSIONS.map((_, i) => ({
      index: i,
      status: i < progress ? 'done' : i === progress ? 'next' : 'locked',
      stars: best[i] ?? 1,
      hard: hard.has(i),
      paid: missionNeedsUnlock(i, unlocked),
    }));
    const map = el('campaign-map');
    renderCampaignMap(map, nodes, (i) => this.showBriefing(i));
    map.hidden = this.campaignView !== 'map';
    el('campaign-view-toggle').textContent = this.campaignView === 'map' ? 'List' : 'Map';
    el('campaign-view-toggle').hidden = false;
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
      const hardTag = hard.has(i) ? ' <span class="hard-badge">H</span>' : '';
      const paid = missionNeedsUnlock(i, isUnlocked()) && unlocked ? '<span class="paid">Full game</span>' : '';
      const badge = paid || (done ? `<span class="stars">${starText(best[i] ?? 1)}</span>${hardTag}` : unlocked ? '▶' : '🔒');
      b.innerHTML = `<span>${i + 1}. ${mission.name}<small>${unlocked ? mission.tagline : 'Locked'}</small></span><span class="medal">${badge}</span>`;
      if (unlocked) b.addEventListener('click', () => this.showBriefing(i));
      list.appendChild(b);
    });
    el('campaign-progress').textContent =
      progress >= MISSIONS.length ? 'Campaign complete' : `${progress} of ${MISSIONS.length} missions complete`;
    el('campaign-detail').hidden = true;
    list.hidden = this.campaignView !== 'list';
    this.show('campaign');
    if (this.campaignView === 'map') {
      // Bring the next mission into view.
      requestAnimationFrame(() => map.querySelector('[data-state="next"]')?.scrollIntoView({ block: 'center' }));
    }
  }

  private reflectBriefingDifficulty(): void {
    for (const b of el('briefing-difficulty').querySelectorAll<HTMLButtonElement>('button')) {
      b.classList.toggle('active', b.dataset.difficulty === this.briefingDifficulty);
    }
  }

  private showBriefing(index: number): void {
    if (missionNeedsUnlock(index, isUnlocked())) {
      this.showUnlock(() => this.showCampaign());
      return;
    }
    const mission = MISSIONS[index];
    el('briefing-title').textContent = `Mission ${index + 1}: ${mission.name}`;
    el('briefing-text').textContent = mission.briefing;
    const story = STORY[index]?.before ?? [];
    el('briefing-story').replaceChildren(...(story.length ? [renderStory(story)] : []));
    el('briefing-objective').textContent = objectiveText(mission);
    this.briefingDifficulty = mission.difficulty;
    this.reflectBriefingDifficulty();
    el('briefing-fog').hidden = !mission.fog;
    const start = el('briefing-start');
    const fresh = start.cloneNode(true) as HTMLElement; // drop the previous mission's listener
    start.replaceWith(fresh);
    fresh.addEventListener('click', () => {
      this.show('game');
      this.controller.launchMission(index, this.briefingDifficulty);
    });
    el('campaign-list').hidden = true;
    el('campaign-map').hidden = true;
    el('campaign-view-toggle').hidden = true;
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
      const paid = skirmishNeedsUnlock(map === CROSSFIRE_VALLEY, this.prefs.opponent, isUnlocked());
      opt.textContent = `${map.name} (${map.grid[0].length}×${map.grid.length})${paid ? ' · Full game' : ''}`;
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
    if (skirmishNeedsUnlock(map === null, opponent, isUnlocked())) {
      this.showUnlock(() => this.showSkirmish());
      return;
    }
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
    el<HTMLInputElement>('settings-volume').value = String(Math.round(sfx.volume * 100));
    el<HTMLInputElement>('settings-ambient').checked = sfx.ambient;
    el<HTMLInputElement>('settings-confirm-end').checked = getPrefs().confirmEndTurn;
    el<HTMLInputElement>('settings-handoff').checked = getPrefs().handoff;
    this.reflectUnlockSetting();
    el('settings-status').textContent = '';
    el('settings-version').textContent = `Crossfire Valley v${APP_VERSION}`;
    this.show('settings');
  }
}

function describeSave(save: SaveGame): string {
  const c = save.config;
  const day = `day ${save.state.day}`;
  if (c.kind === 'campaign') return `Mission ${c.mission + 1}: ${MISSIONS[c.mission].name} — ${day}`;
  if (c.kind === 'bootcamp') return `Boot Camp ${c.lesson + 1}: ${LESSONS[c.lesson].name}`;
  const map = (c.map ?? CROSSFIRE_VALLEY).name;
  if (c.kind === 'skirmish') return `${map} vs Computer (${c.difficulty}) — ${day}`;
  return `${map}, local 2P — ${day}`;
}
