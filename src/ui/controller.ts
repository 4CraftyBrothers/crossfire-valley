import { nextAiCommand, type AiDifficulty } from '../ai/ai';
import { MISSIONS, missionStars } from '../campaign/missions';
import { firstStepsTutorial, isTutorialDone, markTutorialDone, Tutorial } from '../campaign/tutorial';
import { attackableTargets, computeDamage } from '../engine/combat';
import { BUILDABLE_UNITS, TERRAIN_DATA, UNIT_DATA } from '../engine/data';
import { applyCommand, canBuildAt, canCaptureAt } from '../engine/game';
import { key, pathBetween, reachableTiles } from '../engine/movement';
import { encodeMatch, type MatchPayload } from '../engine/serialize';
import { createGame, enemyOf, propertiesOwned, tileAt, unitAt, unitById, visualHp } from '../engine/state';
import { canSeeUnit, isVisible, visibleTiles } from '../engine/vision';
import type { Command, GameEvent, GameState, MapDef, PlayerId, Unit, UnitAction } from '../engine/types';
import { CROSSFIRE_VALLEY } from '../maps';
import { haptic } from '../native';
import { render, setupCanvas, TILE, type Overlays } from './renderer';
import {
  clearSave,
  recordMedal,
  saveCampaignProgress,
  starText,
  writeSave,
  type SaveGame,
  type SessionConfig,
} from './save';
import { sfx } from './sound';
import { BoardViewport } from './viewport';

type UiMode =
  | { kind: 'idle' }
  | { kind: 'selected'; unitId: number; reachable: Map<string, number> }
  | { kind: 'menu'; unitId: number; to: { x: number; y: number } }
  | { kind: 'targeting'; unitId: number; to: { x: number; y: number }; targets: Unit[] }
  | { kind: 'building'; at: { x: number; y: number } };

export interface GameDom {
  viewport: HTMLElement;
  boardWrap: HTMLElement;
  canvas: HTMLCanvasElement;
  actionMenu: HTMLElement;
  banner: HTMLElement;
  tutorial: HTMLElement;
  tutorialText: HTMLElement;
  tutorialSkip: HTMLElement;
  buildMenu: HTMLElement;
  buildOptions: HTMLElement;
  buildCancel: HTMLElement;
  endTurnBtn: HTMLButtonElement;
  undoBtn: HTMLButtonElement;
  menuBtn: HTMLElement;
  pauseMenu: HTMLElement;
  pauseResume: HTMLElement;
  pauseRestart: HTMLElement;
  pauseSound: HTMLElement;
  pauseQuit: HTMLElement;
  resultsMenu: HTMLElement;
  resultsContent: HTMLElement;
  shareMenu: HTMLElement;
  shareTitle: HTMLElement;
  shareLink: HTMLInputElement;
  shareCopy: HTMLElement;
  shareClose: HTMLElement;
  hudTitle: HTMLElement;
  dayLabel: HTMLElement;
  turnChip: HTMLElement;
  fundsRed: HTMLElement;
  fundsBlue: HTMLElement;
  tileInfo: HTMLElement;
  unitInfo: HTMLElement;
}

export interface GameHooks {
  onQuit(): void;
  onMissionSelect(): void;
  onBriefing(index: number): void;
}

const MOBILE_QUERY = '(max-width: 899px)';
const FOCUS_TILE_PX = 40;

export class GameController {
  private state: GameState;
  private config: SessionConfig | null = null;
  private mode: UiMode = { kind: 'idle' };
  private ctx: CanvasRenderingContext2D;
  private viewport: BoardViewport;
  private hover: { x: number; y: number } | null = null;
  private bannerTimer: number | undefined;
  /** Which side the computer plays, or null for two humans. */
  private aiPlayer: PlayerId | null = null;
  /** Incremented to cancel any scheduled AI/replay steps (on restart/quit). */
  private aiToken = 0;
  /** In online PvP: the side this device plays, else null. */
  private localPlayer: PlayerId | null = null;
  /** State at the start of the local player's turn (PvP link source). */
  private turnStartState: GameState | null = null;
  /** Commands issued by the local player this turn (PvP link contents). */
  private turnLog: Command[] = [];
  /** True while animating the opponent's turn from a match link. */
  private replaying = false;
  private lastShareUrl: string | null = null;
  private aiDifficulty: AiDifficulty = 'normal';
  /** States before each human command this turn, for undo. */
  private history: { state: GameState; turnLogLen: number }[] = [];
  private anim: {
    unitId: number;
    path: { x: number; y: number }[];
    start: number;
    duration: number;
    done: () => void;
  } | null = null;
  /** Cosmetic per-unit facing angles (radians, 0 = up). */
  private facings = new Map<number, number>();
  private tutorial: Tutorial | null = null;
  private tutorialHighlight: Set<string> | undefined;
  private lastHumanCommand: Command | undefined;

  constructor(
    private dom: GameDom,
    private hooks: GameHooks,
  ) {
    this.state = createGame(CROSSFIRE_VALLEY);
    this.ctx = setupCanvas(dom.canvas, this.state);
    this.viewport = new BoardViewport(dom.viewport, dom.boardWrap, {
      onTap: (x, y) => this.onTap(x, y),
      onHover: (x, y) => this.onHover(x, y),
      onHoverEnd: () => {
        this.hover = null;
        this.updateInfoPanels();
        this.draw();
      },
    });

    dom.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancel();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cancel();
    });
    dom.endTurnBtn.addEventListener('click', () => this.endTurn());
    dom.undoBtn.addEventListener('click', () => this.undo());
    dom.menuBtn.addEventListener('click', () => this.openPause());
    dom.pauseResume.addEventListener('click', () => this.closePause());
    dom.pauseRestart.addEventListener('click', () => {
      this.closePause();
      this.restart();
    });
    dom.pauseSound.addEventListener('click', () => {
      sfx.toggleMuted();
      this.syncSoundLabel();
    });
    dom.pauseQuit.addEventListener('click', () => this.quitToMenu());
    dom.buildCancel.addEventListener('click', () => this.cancel());
    dom.tutorialSkip.addEventListener('click', () => this.skipTutorial());
    dom.shareClose.addEventListener('click', () => dom.shareMenu.classList.add('hidden'));
    dom.shareCopy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(this.dom.shareLink.value);
      this.dom.shareCopy.textContent = 'Copied!';
      window.setTimeout(() => (this.dom.shareCopy.textContent = 'Copy link'), 1200);
    });
  }

  get campaignMission(): number | null {
    return this.config?.kind === 'campaign' ? this.config.mission : null;
  }

  // ----- sessions --------------------------------------------------------

  startSession(config: SessionConfig): void {
    this.resetSession();
    this.config = config;
    const map = this.mapFor(config);
    const mission = config.kind === 'campaign' ? MISSIONS[config.mission] : null;
    const fog = config.kind === 'campaign' ? MISSIONS[config.mission].fog : config.fog;
    this.state = createGame(map, { fog, objective: mission?.objective });
    this.applyConfig();
    this.mountBoard();
    this.tutorial =
      config.kind === 'campaign' && config.mission === 0 && !isTutorialDone()
        ? new Tutorial(firstStepsTutorial())
        : null;
    const sub =
      config.kind === 'campaign' ? `Mission ${config.mission + 1} — ${map.name}` : `Day ${this.state.day} — ${map.name}`;
    this.showBanner(`${this.state.current} turn`, sub, this.state.current, true);
    this.refresh();
    this.maybeStartAi();
    this.autosave();
  }

  resume(save: SaveGame): void {
    this.resetSession();
    this.config = save.config;
    this.state = structuredClone(save.state);
    this.applyConfig();
    this.mountBoard();
    this.showBanner(`${this.state.current} turn`, `Day ${this.state.day} — resumed`, this.state.current, true);
    this.refresh();
    this.maybeStartAi();
  }

  /** Joined from a match link: we play the side the sender handed over to. */
  joinMatch(payload: MatchPayload): void {
    this.resetSession();
    this.config = { kind: 'pvp', fog: payload.startState.fog, map: null };
    this.state = structuredClone(payload.startState);
    this.aiPlayer = null;
    this.aiDifficulty = 'normal';
    this.localPlayer = enemyOf(payload.startState.current);
    this.mountBoard();
    this.showBanner(
      `${this.state.current} turn`,
      `Day ${this.state.day} — replaying your opponent's moves`,
      this.state.current,
      true,
    );
    this.refresh();
    this.startReplay(payload.commands);
  }

  launchMission(index: number): void {
    this.startSession({ kind: 'campaign', mission: index });
  }

  quitToMenu(): void {
    this.aiToken += 1;
    this.anim = null;
    this.hideOverlays();
    if (this.state.winner) clearSave();
    this.hooks.onQuit();
  }

  private restart(): void {
    if (this.config) this.startSession(this.config);
  }

  private mapFor(config: SessionConfig): MapDef {
    if (config.kind === 'campaign') return MISSIONS[config.mission].map;
    return config.map ?? CROSSFIRE_VALLEY;
  }

  private applyConfig(): void {
    const c = this.config!;
    this.aiPlayer = c.kind === 'campaign' || c.kind === 'skirmish' ? 'blue' : null;
    this.aiDifficulty =
      c.kind === 'skirmish' ? c.difficulty : c.kind === 'campaign' ? MISSIONS[c.mission].difficulty : 'normal';
    this.localPlayer = c.kind === 'pvp' ? 'red' : null;
    if (this.localPlayer) {
      this.turnStartState = structuredClone(this.state);
      this.turnLog = [];
    }
  }

  private mountBoard(): void {
    this.ctx = setupCanvas(this.dom.canvas, this.state);
    const w = this.state.width * TILE;
    const h = this.state.height * TILE;
    this.dom.canvas.style.width = `${w}px`;
    this.dom.canvas.style.height = `${h}px`;
    this.viewport.setContentSize(w, h);
    const focus = this.focusTile();
    this.viewport.frame(focus.x, focus.y, FOCUS_TILE_PX, TILE);
  }

  /** Where the camera opens: the viewer's HQ, else the map center. */
  private focusTile(): { x: number; y: number } {
    const who = this.perspective();
    for (let y = 0; y < this.state.height; y++) {
      for (let x = 0; x < this.state.width; x++) {
        const t = tileAt(this.state, x, y);
        if (t.terrain === 'hq' && t.owner === who) return { x, y };
      }
    }
    return { x: Math.floor(this.state.width / 2), y: Math.floor(this.state.height / 2) };
  }

  /** Shared teardown for starting any fresh game. */
  private resetSession(): void {
    this.aiToken += 1; // cancel any scheduled AI/replay steps
    this.replaying = false;
    this.lastShareUrl = null;
    this.history = [];
    this.anim = null;
    this.facings.clear();
    this.tutorial = null;
    this.tutorialHighlight = undefined;
    this.lastHumanCommand = undefined;
    this.hover = null;
    // A match link in the URL describes the old game; drop it. Custom map
    // links (#map=) stay, so a reload keeps the map.
    if (location.hash.startsWith('#m=')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    this.mode = { kind: 'idle' };
    this.hideOverlays();
  }

  private hideOverlays(): void {
    this.dom.actionMenu.classList.add('hidden');
    this.dom.buildMenu.classList.add('hidden');
    this.dom.shareMenu.classList.add('hidden');
    this.dom.resultsMenu.classList.add('hidden');
    this.dom.pauseMenu.classList.add('hidden');
    this.dom.tutorial.classList.add('hidden');
  }

  private autosave(): void {
    const c = this.config;
    if (!c || c.kind === 'pvp') return;
    if (this.state.winner) clearSave();
    else writeSave({ version: 1, config: c, state: this.state, savedAt: Date.now() });
  }

  private isAiTurn(): boolean {
    return this.aiPlayer !== null && this.state.current === this.aiPlayer;
  }

  /** In PvP: it's the opponent's move (we're waiting or replaying). */
  private isRemoteTurn(): boolean {
    return this.localPlayer !== null && this.state.current !== this.localPlayer;
  }

  // ----- input ---------------------------------------------------------

  private tileFromPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.dom.canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * this.state.width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * this.state.height);
    if (x < 0 || x >= this.state.width || y < 0 || y >= this.state.height) return null;
    return { x, y };
  }

  private onTap(clientX: number, clientY: number): void {
    const pos = this.tileFromPoint(clientX, clientY);
    // A tap also inspects the tile, which is the only "hover" touch has.
    this.hover = pos;
    this.updateInfoPanels();

    if (this.state.winner || this.isAiTurn() || this.anim) {
      this.draw();
      return;
    }
    if (this.isRemoteTurn()) {
      // Waiting on the opponent: tapping the board re-shows the turn link.
      if (!this.replaying && this.lastShareUrl) this.openShareModal();
      this.draw();
      return;
    }
    if (!pos) {
      this.cancel();
      return;
    }

    switch (this.mode.kind) {
      case 'idle':
        this.clickIdle(pos);
        break;
      case 'selected':
        this.clickSelected(pos);
        break;
      case 'targeting':
        this.clickTargeting(pos);
        break;
      case 'menu':
      case 'building':
        this.cancel();
        break;
    }
    this.draw();
  }

  private clickIdle(pos: { x: number; y: number }): void {
    const unit = unitAt(this.state, pos.x, pos.y);
    if (unit && unit.owner === this.state.current && !unit.acted) {
      sfx.select();
      haptic.light();
      this.mode = { kind: 'selected', unitId: unit.id, reachable: reachableTiles(this.state, unit) };
      this.refresh();
      return;
    }
    if (!unit && canBuildAt(this.state, pos.x, pos.y)) {
      this.mode = { kind: 'building', at: pos };
      this.openBuildMenu();
      return;
    }
  }

  private clickSelected(pos: { x: number; y: number }): void {
    if (this.mode.kind !== 'selected') return;
    const unit = unitById(this.state, this.mode.unitId)!;

    // Clicking another of your ready units switches selection.
    const other = unitAt(this.state, pos.x, pos.y);
    if (other && other.id !== unit.id && other.owner === this.state.current && !other.acted) {
      this.mode = { kind: 'selected', unitId: other.id, reachable: reachableTiles(this.state, other) };
      this.refresh();
      return;
    }

    if (!this.mode.reachable.has(key(pos.x, pos.y))) {
      this.cancel();
      return;
    }
    this.mode = { kind: 'menu', unitId: unit.id, to: pos };
    this.openActionMenu(unit, pos);
    this.refresh();
  }

  private clickTargeting(pos: { x: number; y: number }): void {
    if (this.mode.kind !== 'targeting') return;
    const target = this.mode.targets.find((t) => t.x === pos.x && t.y === pos.y);
    if (!target) {
      this.cancel();
      return;
    }
    this.commitMove(this.mode.unitId, this.mode.to, { type: 'attack', targetId: target.id });
  }

  private onHover(clientX: number, clientY: number): void {
    const pos = this.tileFromPoint(clientX, clientY);
    const changed = pos?.x !== this.hover?.x || pos?.y !== this.hover?.y;
    this.hover = pos;
    if (changed) {
      this.updateInfoPanels();
      this.draw();
    }
  }

  private cancel(): void {
    this.mode = { kind: 'idle' };
    this.dom.actionMenu.classList.add('hidden');
    this.dom.buildMenu.classList.add('hidden');
    this.refresh();
  }

  // ----- menus ---------------------------------------------------------

  private openActionMenu(unit: Unit, to: { x: number; y: number }): void {
    const moved = to.x !== unit.x || to.y !== unit.y;
    const targets = attackableTargets(this.state, unit, to.x, to.y, moved);
    const menu = this.dom.actionMenu;
    menu.innerHTML = '';

    const addButton = (label: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener('click', fn);
      menu.appendChild(b);
    };

    if (targets.length > 0) {
      addButton(`⚔ Attack (${targets.length})`, '', () => {
        this.mode = { kind: 'targeting', unitId: unit.id, to, targets };
        menu.classList.add('hidden');
        this.refresh();
      });
    }
    if (canCaptureAt(this.state, unit, to.x, to.y)) {
      addButton('⚑ Capture', '', () => this.commitMove(unit.id, to, { type: 'capture' }));
    }
    addButton('✔ Wait', '', () => this.commitMove(unit.id, to, { type: 'wait' }));
    addButton('✕ Cancel', 'danger', () => this.cancel());

    if (window.matchMedia(MOBILE_QUERY).matches) {
      // Phones: the stylesheet docks the menu above the bottom bar.
      menu.style.left = '';
      menu.style.top = '';
    } else {
      // Desktop: beside the destination tile, clamped inside the viewport.
      const rect = this.dom.canvas.getBoundingClientRect();
      const vp = this.dom.viewport.getBoundingClientRect();
      const scale = rect.width / (this.state.width * TILE);
      const left = rect.left - vp.left + (to.x + 1) * TILE * scale + 6;
      const top = rect.top - vp.top + to.y * TILE * scale;
      menu.style.left = `${Math.max(0, Math.min(left, vp.width - 140))}px`;
      menu.style.top = `${Math.max(0, Math.min(top, vp.height - 160))}px`;
    }
    menu.classList.remove('hidden');
  }

  private openBuildMenu(): void {
    const options = this.dom.buildOptions;
    options.innerHTML = '';
    const funds = this.state.funds[this.state.current];

    for (const type of BUILDABLE_UNITS) {
      const data = UNIT_DATA[type];
      const b = document.createElement('button');
      b.className = 'build-option';
      b.disabled = data.cost > funds;
      const desc =
        data.minRange > 1
          ? `Range ${data.minRange}-${data.maxRange}, fires only when still`
          : data.canCapture
            ? 'Captures buildings'
            : `Move ${data.move}`;
      b.innerHTML = `<span>${data.name}<small>${desc}</small></span><span class="cost">$${data.cost}</span>`;
      b.addEventListener('click', () => {
        if (this.mode.kind !== 'building') return;
        try {
          this.apply({ kind: 'build', at: this.mode.at, unitType: type });
        } catch (err) {
          console.error(err);
        }
        this.cancel();
      });
      options.appendChild(b);
    }
    this.dom.buildMenu.classList.remove('hidden');
  }

  private openPause(): void {
    this.cancel();
    this.syncSoundLabel();
    this.dom.pauseRestart.textContent = this.campaignMission !== null ? 'Retry mission' : 'Restart';
    this.dom.pauseMenu.classList.remove('hidden');
  }

  private closePause(): void {
    this.dom.pauseMenu.classList.add('hidden');
  }

  /** Hardware back: close whatever is on top, else pause. */
  handleBack(): void {
    const d = this.dom;
    if (!d.pauseMenu.classList.contains('hidden')) {
      this.closePause();
    } else if (!d.resultsMenu.classList.contains('hidden')) {
      // Results need a decision; leave them up.
    } else if (!d.shareMenu.classList.contains('hidden')) {
      d.shareMenu.classList.add('hidden');
    } else if (this.mode.kind !== 'idle') {
      this.cancel();
    } else {
      this.openPause();
    }
  }

  private syncSoundLabel(): void {
    this.dom.pauseSound.textContent = sfx.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
  }

  // ----- commands ------------------------------------------------------

  private commitMove(unitId: number, to: { x: number; y: number }, action: UnitAction): void {
    this.dom.actionMenu.classList.add('hidden');
    try {
      this.apply({ kind: 'move', unitId, to, action });
    } catch (err) {
      console.error(err);
    }
    this.mode = { kind: 'idle' };
    this.refresh();
  }

  private endTurn(): void {
    if (this.state.winner || this.isAiTurn() || this.isRemoteTurn() || this.anim) return;
    this.cancel();
    this.apply({ kind: 'endTurn' });
    this.maybeStartAi();
  }

  private undo(): void {
    if (this.state.winner || this.isAiTurn() || this.isRemoteTurn() || this.replaying || this.anim) return;
    if (this.state.fog) return; // undo would leak revealed information
    const entry = this.history.pop();
    if (!entry) return;
    this.state = entry.state;
    this.turnLog.length = entry.turnLogLen;
    this.mode = { kind: 'idle' };
    this.dom.actionMenu.classList.add('hidden');
    this.dom.buildMenu.classList.add('hidden');
    sfx.undo();
    this.refresh();
    this.autosave();
  }

  // ----- results ---------------------------------------------------------

  private showMissionResult(won: boolean): void {
    const index = this.campaignMission;
    if (index === null) return;
    const mission = MISSIONS[index];
    const stars = won ? missionStars(mission, this.state) : 0;
    if (won) {
      saveCampaignProgress(index + 1);
      recordMedal(index, stars);
    }
    const last = index === MISSIONS.length - 1;
    const card = this.dom.resultsContent;
    const outcome =
      mission.objective?.kind === 'survive'
        ? `You held ${mission.name} through day ${this.state.day}.`
        : `${mission.name} secured on day ${this.state.day}.`;
    card.innerHTML = won
      ? `<h2>${last ? '🏆 Campaign complete!' : `Mission ${index + 1} complete!`}</h2>
         <p class="medal-line">${starText(stars)}</p>
         <p class="briefing-text">${last ? 'Crossfire Valley is yours. Thanks for playing, Commander.' : outcome}</p>`
      : `<h2>Mission failed</h2><p class="briefing-text">Blue holds ${mission.name}. Regroup and try again.</p>`;

    const button = (label: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = label;
      b.addEventListener('click', () => {
        this.dom.resultsMenu.classList.add('hidden');
        fn();
      });
      card.appendChild(b);
    };

    if (won && !last) button(`Next: ${MISSIONS[index + 1].name}`, 'btn primary', () => this.hooks.onBriefing(index + 1));
    if (!won) button('Retry mission', 'btn primary', () => this.launchMission(index));
    button('Mission select', 'btn', () => this.hooks.onMissionSelect());
    if (won && last) button('Main menu', 'btn', () => this.quitToMenu());
    this.dom.resultsMenu.classList.remove('hidden');
  }

  private showSkirmishResult(winner: PlayerId): void {
    const card = this.dom.resultsContent;
    const hotseat = this.aiPlayer === null;
    const title = hotseat ? `${winner === 'red' ? 'Red' : 'Blue'} wins!` : winner === this.aiPlayer ? 'Defeat' : 'Victory!';
    card.innerHTML = `<h2>${title}</h2><p class="briefing-text">${
      winner === 'red' ? 'Red' : 'Blue'
    } took the field on day ${this.state.day}.</p>`;

    const again = document.createElement('button');
    again.className = 'btn primary';
    again.textContent = 'Play again';
    again.addEventListener('click', () => this.restart());
    const menu = document.createElement('button');
    menu.className = 'btn';
    menu.textContent = 'Main menu';
    menu.addEventListener('click', () => this.quitToMenu());
    card.append(again, menu);
    this.dom.resultsMenu.classList.remove('hidden');
  }

  // ----- online PvP ------------------------------------------------------

  private startReplay(commands: Command[]): void {
    this.replaying = true;
    const token = this.aiToken;
    const queue = [...commands];
    const step = () => {
      if (token !== this.aiToken) return; // game was restarted
      const cmd = queue.shift();
      if (!cmd) {
        this.replaying = false;
        this.refresh();
        return;
      }
      try {
        this.apply(cmd);
      } catch (err) {
        console.error('Corrupt match link (replay failed):', err);
        this.replaying = false;
        this.startSession({ kind: 'skirmish', difficulty: 'normal', fog: false, map: null });
        return;
      }
      window.setTimeout(step, queue.length > 0 ? 320 : 0);
    };
    window.setTimeout(step, 1400);
  }

  private openShareModal(): void {
    if (!this.lastShareUrl) return;
    const won = this.state.winner === this.localPlayer;
    this.dom.shareTitle.textContent = this.state.winner
      ? won
        ? 'Victory! Share the result'
        : 'Turn complete'
      : 'Turn complete';
    this.dom.shareLink.value = this.lastShareUrl;
    this.dom.shareMenu.classList.remove('hidden');
  }

  private async shareTurn(): Promise<void> {
    if (!this.turnStartState) return;
    try {
      const code = await encodeMatch(this.turnStartState, this.turnLog);
      this.lastShareUrl = `${location.origin}${location.pathname}#m=${code}`;
      this.openShareModal();
    } catch (err) {
      console.error('Failed to encode match link:', err);
    }
  }

  /** Kick off the AI turn loop if it's the computer's move. */
  private maybeStartAi(): void {
    if (this.state.winner || !this.isAiTurn()) return;
    const token = this.aiToken;
    // Let the turn banner play before the first computer move.
    window.setTimeout(() => this.aiStep(token), 1400);
  }

  private aiStep(token: number): void {
    if (token !== this.aiToken || this.state.winner || !this.isAiTurn()) return;
    try {
      this.apply(nextAiCommand(this.state, this.aiDifficulty));
    } catch (err) {
      // A bug in the AI should never soft-lock the game: concede the turn.
      console.error('AI error, ending turn:', err);
      this.apply({ kind: 'endTurn' });
    }
    if (!this.state.winner && this.isAiTurn()) {
      window.setTimeout(() => this.aiStep(token), 320);
    }
  }

  private apply(cmd: Command): void {
    const prev = this.state;
    const wasLocalTurn = this.localPlayer !== null && prev.current === this.localPlayer;
    const humanTurn =
      !this.replaying &&
      (this.aiPlayer === null || prev.current !== this.aiPlayer) &&
      (this.localPlayer === null || prev.current === this.localPlayer);

    // The route for the slide animation must come from the pre-move state.
    let path: { x: number; y: number }[] | null = null;
    if (cmd.kind === 'move') {
      const unit = unitById(prev, cmd.unitId);
      if (unit && (unit.x !== cmd.to.x || unit.y !== cmd.to.y)) {
        path = pathBetween(prev, unit, cmd.to);
      }
    }

    const { state, events } = applyCommand(prev, cmd);
    if (humanTurn && cmd.kind !== 'endTurn') {
      this.history.push({ state: prev, turnLogLen: this.turnLog.length });
    }
    if (humanTurn) this.lastHumanCommand = cmd;
    if (wasLocalTurn) this.turnLog.push(cmd);
    this.state = state;

    // An ambush may have stopped the unit short: animate only to where it
    // actually ended up, and face the unit along its final step.
    const movedEv = events.find((e) => e.type === 'moved');
    if (path && movedEv && movedEv.type === 'moved') {
      const idx = path.findIndex((p) => p.x === movedEv.to.x && p.y === movedEv.to.y);
      if (idx >= 0) path = path.slice(0, idx + 1);
      if (path.length > 1) {
        const a = path[path.length - 2];
        const b = path[path.length - 1];
        this.facings.set(movedEv.unitId, Math.atan2(b.x - a.x, -(b.y - a.y)));
      }
    }
    // Combatants swivel to face each other.
    if (cmd.kind === 'move' && cmd.action.type === 'attack') {
      const attacker = unitById(state, cmd.unitId);
      const target = unitById(prev, cmd.action.targetId);
      if (attacker && target) {
        this.facings.set(attacker.id, Math.atan2(target.x - attacker.x, -(target.y - attacker.y)));
        this.facings.set(target.id, Math.atan2(attacker.x - target.x, -(attacker.y - target.y)));
        if (attacker.type === 'artillery') sfx.mortar();
      }
    }

    const finish = () => {
      this.processEvents(events);
      this.refresh();
      this.autosave();
      // In PvP, the local turn ending (endTurn or game over) produces the link.
      if (wasLocalTurn && (this.state.winner !== null || this.state.current !== this.localPlayer)) {
        void this.shareTurn();
      }
    };

    if (path && path.length > 1 && cmd.kind === 'move') {
      const mover = unitById(prev, cmd.unitId);
      sfx.move(mover ? UNIT_DATA[mover.type].moveClass : 'treads');
      this.refreshHud();
      this.animate(cmd.unitId, path, finish);
    } else {
      finish();
    }
  }

  // ----- animation -------------------------------------------------------

  private animate(unitId: number, path: { x: number; y: number }[], done: () => void): void {
    const duration = Math.min(90 * (path.length - 1), 270);
    this.anim = { unitId, path, start: performance.now(), duration, done };
    requestAnimationFrame(() => this.animTick());
  }

  private animTick(): void {
    const anim = this.anim;
    if (!anim) return; // cancelled by a restart
    const t = (performance.now() - anim.start) / anim.duration;
    if (t >= 1) {
      this.anim = null;
      this.draw();
      anim.done();
      return;
    }
    this.draw();
    requestAnimationFrame(() => this.animTick());
  }

  private slidePosition(): { unitId: number; x: number; y: number; angle: number; phase: number } | null {
    const anim = this.anim;
    if (!anim) return null;
    const raw = Math.min(1, (performance.now() - anim.start) / anim.duration);
    const t = raw * raw * (3 - 2 * raw); // smoothstep: ease out of and into tiles
    const seg = t * (anim.path.length - 1);
    const i = Math.min(anim.path.length - 2, Math.floor(seg));
    const frac = seg - i;
    const dx = anim.path[i + 1].x - anim.path[i].x;
    const dy = anim.path[i + 1].y - anim.path[i].y;
    return {
      unitId: anim.unitId,
      x: anim.path[i].x + dx * frac,
      y: anim.path[i].y + dy * frac,
      angle: Math.atan2(dx, -dy),
      phase: seg,
    };
  }

  private processEvents(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'damage':
          if (ev.destroyed) {
            sfx.explode();
            haptic.heavy();
            this.shake();
          } else {
            sfx.attack();
            haptic.medium();
          }
          this.flashTile(ev.at);
          this.spawnDamagePopup(ev.at, ev.amount, ev.destroyed);
          break;
        case 'ambushed':
          sfx.ambush();
          this.spawnTextPopup(ev.at, 'AMBUSH!');
          break;
        case 'captureProgress':
          sfx.capture();
          break;
        case 'captured':
          sfx.captured();
          haptic.medium();
          break;
        case 'built':
          sfx.build();
          break;
        case 'turnStarted': {
          sfx.turn();
          if (ev.player !== this.aiPlayer) haptic.light();
          this.history = []; // undo never crosses a turn boundary
          let hint = 'pass the device';
          if (this.aiPlayer !== null) {
            hint = ev.player === this.aiPlayer ? 'computer is thinking…' : 'your move';
            const goal = this.objectiveHint();
            if (goal && ev.player !== this.aiPlayer) hint += ` · ${goal}`;
          } else if (this.localPlayer !== null) {
            hint = ev.player === this.localPlayer ? 'your move' : 'send the link to your opponent';
            if (ev.player === this.localPlayer) {
              // A new local turn begins: this state is what the next link replays from.
              this.turnStartState = structuredClone(this.state);
              this.turnLog = [];
            }
          }
          this.showBanner(`${ev.player} turn`, `Day ${ev.day} — income $${ev.income} — ${hint}`, ev.player, true);
          break;
        }
        case 'victory': {
          const humanWon =
            this.aiPlayer !== null
              ? ev.winner !== this.aiPlayer
              : this.localPlayer !== null
                ? ev.winner === this.localPlayer
                : true; // hotseat: someone at this device won either way
          if (humanWon) {
            sfx.victory();
            haptic.success();
          } else {
            sfx.defeat();
            haptic.warning();
          }
          this.showBanner(`${ev.winner} wins!`, `Day ${this.state.day}`, ev.winner, false);
          if (this.localPlayer === null) {
            // Let the banner land, then show the result dialog.
            const token = this.aiToken;
            window.setTimeout(() => {
              if (token !== this.aiToken) return;
              if (this.campaignMission !== null) this.showMissionResult(ev.winner === 'red');
              else this.showSkirmishResult(ev.winner);
            }, 1500);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  // ----- presentation --------------------------------------------------

  private shake(): void {
    const el = this.dom.boardWrap;
    el.classList.remove('shake');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('shake');
    window.setTimeout(() => el.classList.remove('shake'), 350);
  }

  private flashTile(at: { x: number; y: number }): void {
    if (!isVisible(this.state, this.perspective(), at.x, at.y)) return;
    const flash = document.createElement('div');
    flash.className = 'hit-flash';
    flash.style.left = `${at.x * TILE}px`;
    flash.style.top = `${at.y * TILE}px`;
    flash.style.width = `${TILE}px`;
    flash.style.height = `${TILE}px`;
    this.dom.boardWrap.appendChild(flash);
    window.setTimeout(() => flash.remove(), 400);
  }

  private spawnDamagePopup(at: { x: number; y: number }, amount: number, destroyed: boolean): void {
    this.spawnTextPopup(at, destroyed ? '💥' : `-${Math.ceil(amount / 10)}`, destroyed);
  }

  private spawnTextPopup(at: { x: number; y: number }, text: string, destroy = false): void {
    // Don't leak combat happening inside the fog.
    if (!isVisible(this.state, this.perspective(), at.x, at.y)) return;
    const pop = document.createElement('div');
    pop.className = destroy ? 'dmg-pop destroy' : 'dmg-pop';
    pop.textContent = text;
    pop.style.left = `${(at.x + 0.3) * TILE}px`;
    pop.style.top = `${at.y * TILE}px`;
    this.dom.boardWrap.appendChild(pop);
    window.setTimeout(() => pop.remove(), 1000);
  }

  private showBanner(title: string, sub: string, player: string, autoFade: boolean): void {
    const banner = this.dom.banner;
    window.clearTimeout(this.bannerTimer);
    banner.className = player;
    banner.innerHTML = `<div>${title.toUpperCase()}</div><div class="sub">${sub}</div>`;
    if (autoFade) {
      this.bannerTimer = window.setTimeout(() => {
        banner.classList.add('fading');
        this.bannerTimer = window.setTimeout(() => banner.classList.add('hidden'), 400);
      }, 1300);
    }
  }

  private refresh(): void {
    // Read-only state handle for tests and debugging.
    (window as unknown as { __tcState: GameState }).__tcState = this.state;
    this.refreshHud();
    this.updateInfoPanels();
    this.updateTutorial();
    this.draw();
  }

  /** Live progress toward a campaign objective, e.g. "hold out 2 more days". */
  private objectiveHint(): string | null {
    const o = this.state.objective;
    if (!o) return null;
    if (o.kind === 'survive') {
      const left = o.day - this.state.day;
      return left > 0 ? `hold out ${left} more day${left === 1 ? '' : 's'}` : 'hold out';
    }
    return `hold ${propertiesOwned(this.state, 'red')}/${o.count} buildings`;
  }

  private sessionTitle(): string {
    const c = this.config;
    if (!c) return '';
    if (c.kind === 'campaign') {
      const goal = this.objectiveHint();
      return `Mission ${c.mission + 1}: ${MISSIONS[c.mission].name}${goal ? ` · ${goal}` : ''}`;
    }
    const map = (c.map ?? CROSSFIRE_VALLEY).name;
    if (c.kind === 'skirmish') return `${map} · vs Computer`;
    if (c.kind === 'hotseat') return `${map} · Local 2P`;
    return `${map} · Online`;
  }

  private refreshHud(): void {
    const s = this.state;
    this.dom.hudTitle.textContent = this.sessionTitle();
    this.dom.dayLabel.textContent = `Day ${s.day}`;
    this.dom.turnChip.textContent = s.winner ? `${s.winner} wins` : `${s.current}'s turn`;
    this.dom.turnChip.className = `chip ${s.winner ?? s.current}`;
    this.dom.fundsRed.textContent = `Red $${s.funds.red}`;
    this.dom.fundsBlue.textContent = `Blue $${s.funds.blue}`;
    this.dom.endTurnBtn.disabled = s.winner !== null || this.isAiTurn() || this.isRemoteTurn();
    this.dom.undoBtn.disabled =
      this.history.length === 0 ||
      s.fog ||
      s.winner !== null ||
      this.isAiTurn() ||
      this.isRemoteTurn() ||
      this.replaying;
    this.dom.undoBtn.title = s.fog ? 'Undo is disabled under fog of war' : 'Undo your last move this turn';
  }

  private updateInfoPanels(): void {
    const pos = this.hover;
    if (!pos) {
      this.dom.tileInfo.textContent = 'Tap a tile';
      this.dom.unitInfo.textContent = '—';
      return;
    }
    const tile = tileAt(this.state, pos.x, pos.y);
    const td = TERRAIN_DATA[tile.terrain];
    const ownerText = td.capturable ? ` · ${tile.owner ?? 'neutral'}` : '';
    this.dom.tileInfo.innerHTML = `
      <div class="row"><span>${td.name}${ownerText}</span><span>${'★'.repeat(td.defenseStars) || '—'}</span></div>
      ${td.capturable ? '<div class="row"><span>Income</span><span>$1000</span></div>' : ''}
    `;

    const unit = unitAt(this.state, pos.x, pos.y);
    if (
      !unit ||
      !isVisible(this.state, this.perspective(), pos.x, pos.y) ||
      !canSeeUnit(this.state, this.perspective(), unit)
    ) {
      this.dom.unitInfo.textContent = '—';
      return;
    }
    const ud = UNIT_DATA[unit.type];
    const range = ud.minRange === ud.maxRange ? `${ud.maxRange}` : `${ud.minRange}-${ud.maxRange}`;
    let forecast = '';
    if (this.mode.kind === 'targeting' && unit.owner !== this.state.current) {
      const attacker = unitById(this.state, this.mode.unitId);
      if (attacker && this.mode.targets.some((t) => t.id === unit.id)) {
        const dmg = computeDamage(this.state, attacker, unit);
        forecast = `<div class="row"><span>Forecast</span><span>-${Math.ceil(dmg / 10)} HP</span></div>`;
      }
    }
    this.dom.unitInfo.innerHTML = `
      <div class="row"><span><b>${ud.name}</b> (${unit.owner})</span><span>${visualHp(unit)}/10 HP</span></div>
      <div class="row"><span>Move ${ud.move}</span><span>Range ${range}</span></div>
      ${unit.acted && unit.owner === this.state.current ? '<div class="row"><span>Already acted</span></div>' : ''}
      ${forecast}
    `;
  }

  private updateTutorial(): void {
    const box = this.dom.tutorial;
    const t = this.tutorial;
    if (!t) {
      box.classList.add('hidden');
      this.tutorialHighlight = undefined;
      return;
    }
    const selectedUnit = this.mode.kind === 'selected' ? unitById(this.state, this.mode.unitId) : undefined;
    const step = t.current({
      state: this.state,
      modeKind: this.mode.kind,
      selectedUnit,
      lastCommand: this.lastHumanCommand,
    });
    if (!step) {
      markTutorialDone();
      this.tutorial = null;
      box.classList.add('hidden');
      this.tutorialHighlight = undefined;
      return;
    }
    this.dom.tutorialText.innerHTML = step.text;
    this.dom.tutorialSkip.textContent = step.final ? 'Got it' : 'Skip';
    this.tutorialHighlight = step.highlight;
    box.classList.toggle('hidden', this.isAiTurn() || this.state.winner !== null);
  }

  private skipTutorial(): void {
    markTutorialDone();
    this.tutorial = null;
    this.refresh();
  }

  /** Whose vision the fog is rendered from on this device. */
  private perspective(): PlayerId {
    if (this.localPlayer) return this.localPlayer;
    if (this.aiPlayer) return enemyOf(this.aiPlayer);
    return this.state.current; // hotseat: whoever is playing right now
  }

  private draw(): void {
    const ov: Overlays = {
      hover: this.hover ?? undefined,
      slide: this.slidePosition() ?? undefined,
      highlight: this.tutorialHighlight,
    };
    switch (this.mode.kind) {
      case 'selected':
        ov.reachable = new Set(this.mode.reachable.keys());
        ov.selectedUnitId = this.mode.unitId;
        break;
      case 'menu':
        ov.ghost = { unitId: this.mode.unitId, x: this.mode.to.x, y: this.mode.to.y };
        break;
      case 'targeting':
        ov.ghost = { unitId: this.mode.unitId, x: this.mode.to.x, y: this.mode.to.y };
        ov.targets = new Set(this.mode.targets.map((t) => t.id));
        break;
      default:
        break;
    }
    let fog: Set<number> | undefined;
    if (this.state.fog) {
      const viewer = this.perspective();
      fog = visibleTiles(this.state, viewer);
      // Forest ambushers stay invisible even on lit tiles.
      ov.hiddenUnits = new Set(
        this.state.units.filter((u) => !canSeeUnit(this.state, viewer, u, fog)).map((u) => u.id),
      );
    }
    render(this.ctx, this.state, ov, fog, this.facings);
  }
}
