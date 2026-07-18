import { nextAiCommand, type AiDifficulty } from '../ai/ai';
import { MISSIONS } from '../campaign/missions';
import { attackableTargets, computeDamage } from '../engine/combat';
import { BUILDABLE_UNITS, TERRAIN_DATA, UNIT_DATA } from '../engine/data';
import { applyCommand, canBuildAt, canCaptureAt } from '../engine/game';
import { key, pathBetween, reachableTiles } from '../engine/movement';
import { sfx } from './sound';
import { encodeMatch, type MatchPayload } from '../engine/serialize';
import { createGame, enemyOf, tileAt, unitAt, unitById, visualHp } from '../engine/state';
import { canSeeUnit, isVisible, visibleTiles } from '../engine/vision';
import type { Command, GameEvent, GameState, MapDef, PlayerId, Unit, UnitAction } from '../engine/types';
import { render, setupCanvas, TILE, type Overlays } from './renderer';

type UiMode =
  | { kind: 'idle' }
  | { kind: 'selected'; unitId: number; reachable: Map<string, number> }
  | { kind: 'menu'; unitId: number; to: { x: number; y: number } }
  | { kind: 'targeting'; unitId: number; to: { x: number; y: number }; targets: Unit[] }
  | { kind: 'building'; at: { x: number; y: number } };

interface Dom {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
  actionMenu: HTMLElement;
  banner: HTMLElement;
  buildMenu: HTMLElement;
  buildOptions: HTMLElement;
  buildCancel: HTMLElement;
  endTurnBtn: HTMLButtonElement;
  restartBtn: HTMLElement;
  undoBtn: HTMLButtonElement;
  muteBtn: HTMLElement;
  modeSelect: HTMLSelectElement;
  fogToggle: HTMLInputElement;
  campaignBtn: HTMLElement;
  campaignMenu: HTMLElement;
  campaignContent: HTMLElement;
  shareMenu: HTMLElement;
  shareTitle: HTMLElement;
  shareLink: HTMLInputElement;
  shareCopy: HTMLElement;
  shareClose: HTMLElement;
  dayLabel: HTMLElement;
  turnChip: HTMLElement;
  fundsRed: HTMLElement;
  fundsBlue: HTMLElement;
  tileInfo: HTMLElement;
  unitInfo: HTMLElement;
}

export class GameController {
  private state: GameState;
  private mode: UiMode = { kind: 'idle' };
  private ctx: CanvasRenderingContext2D;
  private hover: { x: number; y: number } | null = null;
  private bannerTimer: number | undefined;
  /** Which side the computer plays, or null for hotseat. */
  private aiPlayer: PlayerId | null = null;
  /** Incremented to cancel any scheduled AI/replay steps (on restart/mode change). */
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
  /** Index into MISSIONS while a campaign mission is being played. */
  private campaignMission: number | null = null;
  private aiDifficulty: AiDifficulty = 'normal';
  /** States before each human command this turn, for undo. */
  private history: { state: GameState; turnLogLen: number }[] = [];
  /** In-flight movement slide animation. */
  private anim: {
    unitId: number;
    path: { x: number; y: number }[];
    start: number;
    duration: number;
    done: () => void;
  } | null = null;
  /** Cosmetic per-unit facing angles (radians, 0 = up). */
  private facings = new Map<number, number>();

  constructor(
    private map: MapDef,
    private dom: Dom,
    initial?: MatchPayload,
  ) {
    this.state = initial
      ? structuredClone(initial.startState)
      : createGame(map, { fog: dom.fogToggle.checked });
    this.ctx = setupCanvas(dom.canvas, this.state);

    dom.canvas.addEventListener('click', (e) => this.onClick(e));
    dom.canvas.addEventListener('mousemove', (e) => this.onHover(e));
    dom.canvas.addEventListener('mouseleave', () => {
      this.hover = null;
      this.draw();
    });
    dom.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancel();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cancel();
    });
    dom.endTurnBtn.addEventListener('click', () => this.endTurn());
    dom.restartBtn.addEventListener('click', () => this.restart());
    dom.undoBtn.addEventListener('click', () => this.undo());
    dom.muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
    dom.muteBtn.addEventListener('click', () => {
      dom.muteBtn.textContent = sfx.toggleMuted() ? '🔇' : '🔊';
    });
    dom.modeSelect.addEventListener('change', () => {
      this.campaignMission = null; // switching mode leaves the campaign
      this.restart();
    });
    dom.fogToggle.addEventListener('change', () => this.restart());
    dom.campaignBtn.addEventListener('click', () => this.openCampaignMenu());
    dom.buildCancel.addEventListener('click', () => this.cancel());
    dom.shareClose.addEventListener('click', () => dom.shareMenu.classList.add('hidden'));
    dom.shareCopy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(this.dom.shareLink.value);
      this.dom.shareCopy.textContent = 'Copied!';
      window.setTimeout(() => (this.dom.shareCopy.textContent = 'Copy link'), 1200);
    });

    if (initial) {
      // Joined from a match link: we play the side the sender handed over to.
      this.dom.modeSelect.value = 'pvp';
      this.dom.fogToggle.checked = initial.startState.fog;
      this.localPlayer = enemyOf(initial.startState.current);
      this.showBanner(
        `${initial.startState.current} turn`,
        `Day ${initial.startState.day} — replaying your opponent's moves`,
        initial.startState.current,
        true,
      );
      this.refresh();
      this.startReplay(initial.commands);
    } else {
      this.applyModeFromSelect();
      this.showBanner(`${this.state.current} turn`, `Day ${this.state.day} — ${map.name}`, this.state.current, true);
      this.refresh();
      this.maybeStartAi();
    }
  }

  private applyModeFromSelect(): void {
    const mode = this.dom.modeSelect.value;
    this.aiPlayer = mode.startsWith('ai') ? 'blue' : null;
    this.aiDifficulty = mode === 'ai-easy' ? 'easy' : mode === 'ai-hard' ? 'hard' : 'normal';
    this.localPlayer = mode === 'pvp' ? 'red' : null;
    if (this.localPlayer) {
      this.turnStartState = structuredClone(this.state);
      this.turnLog = [];
    }
  }

  private isAiTurn(): boolean {
    return this.aiPlayer !== null && this.state.current === this.aiPlayer;
  }

  /** In PvP: it's the opponent's move (we're waiting or replaying). */
  private isRemoteTurn(): boolean {
    return this.localPlayer !== null && this.state.current !== this.localPlayer;
  }

  // ----- input ---------------------------------------------------------

  private tileFromEvent(e: MouseEvent): { x: number; y: number } | null {
    const rect = this.dom.canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * this.state.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * this.state.height);
    if (x < 0 || x >= this.state.width || y < 0 || y >= this.state.height) return null;
    return { x, y };
  }

  private onClick(e: MouseEvent): void {
    if (this.state.winner || this.isAiTurn() || this.anim) return;
    if (this.isRemoteTurn()) {
      // Waiting on the opponent: clicking the board re-shows the turn link.
      if (!this.replaying && this.lastShareUrl) this.openShareModal();
      return;
    }
    const pos = this.tileFromEvent(e);
    if (!pos) return;

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
  }

  private clickIdle(pos: { x: number; y: number }): void {
    const unit = unitAt(this.state, pos.x, pos.y);
    if (unit && unit.owner === this.state.current && !unit.acted) {
      sfx.select();
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

  private onHover(e: MouseEvent): void {
    const pos = this.tileFromEvent(e);
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

    // Position beside the destination tile, clamped to the stage.
    const rect = this.dom.canvas.getBoundingClientRect();
    const scale = rect.width / (this.state.width * TILE);
    const left = Math.min((to.x + 1) * TILE * scale + 6, rect.width - 130);
    const top = Math.min(to.y * TILE * scale, rect.height - 150);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
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
  }

  private restart(): void {
    if (this.campaignMission !== null) {
      this.launchMission(this.campaignMission); // Restart = retry the mission
      return;
    }
    this.resetSession();
    this.state = createGame(this.map, { fog: this.dom.fogToggle.checked });
    this.applyModeFromSelect();
    this.ctx = setupCanvas(this.dom.canvas, this.state);
    this.showBanner(`${this.state.current} turn`, `Day ${this.state.day} — ${this.map.name}`, this.state.current, true);
    this.refresh();
    this.maybeStartAi();
  }

  /** Shared teardown for starting any fresh game. */
  private resetSession(): void {
    this.aiToken += 1; // cancel any scheduled AI/replay steps
    this.replaying = false;
    this.lastShareUrl = null;
    this.history = [];
    this.anim = null;
    this.facings.clear();
    // A match link in the URL describes the old game; drop it. Custom map
    // links (#map=) stay, so a reload keeps the map.
    if (location.hash.startsWith('#m=')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    this.mode = { kind: 'idle' };
    this.dom.actionMenu.classList.add('hidden');
    this.dom.buildMenu.classList.add('hidden');
    this.dom.shareMenu.classList.add('hidden');
    this.dom.campaignMenu.classList.add('hidden');
  }

  /** Swap in a user-made map (from the editor or a #map= link) and restart. */
  playCustomMap(map: MapDef): void {
    this.campaignMission = null;
    this.map = map;
    this.restart();
  }

  // ----- campaign --------------------------------------------------------

  private static readonly PROGRESS_KEY = 'tactics-clash-campaign';

  private campaignProgress(): number {
    return parseInt(localStorage.getItem(GameController.PROGRESS_KEY) ?? '0', 10) || 0;
  }

  private saveCampaignProgress(completed: number): void {
    if (completed > this.campaignProgress()) {
      localStorage.setItem(GameController.PROGRESS_KEY, String(completed));
    }
  }

  private openCampaignMenu(): void {
    const progress = this.campaignProgress();
    const card = this.dom.campaignContent;
    card.innerHTML = '<h2>Campaign</h2><p class="campaign-sub">You command Red. Win to unlock the next mission.</p>';
    MISSIONS.forEach((mission, i) => {
      const unlocked = i <= progress;
      const done = i < progress;
      const b = document.createElement('button');
      b.className = 'mission-option';
      b.disabled = !unlocked;
      b.innerHTML = `<span>${i + 1}. ${mission.name}<small>${unlocked ? mission.tagline : 'Locked'}</small></span><span class="medal">${done ? '⭐' : unlocked ? '▶' : '🔒'}</span>`;
      if (unlocked) b.addEventListener('click', () => this.showBriefing(i));
      card.appendChild(b);
    });
    const close = document.createElement('button');
    close.className = 'btn';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.dom.campaignMenu.classList.add('hidden'));
    card.appendChild(close);
    this.dom.campaignMenu.classList.remove('hidden');
  }

  private showBriefing(index: number): void {
    const mission = MISSIONS[index];
    const card = this.dom.campaignContent;
    card.innerHTML = `
      <h2>Mission ${index + 1}: ${mission.name}</h2>
      <p class="briefing-text">${mission.briefing}</p>
      ${mission.fog ? '<p class="campaign-sub">⚠ Fog of war is active on this mission.</p>' : ''}
    `;
    const start = document.createElement('button');
    start.className = 'btn primary';
    start.textContent = 'Start mission';
    start.addEventListener('click', () => this.launchMission(index));
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = 'Back';
    back.addEventListener('click', () => this.openCampaignMenu());
    card.append(start, back);
  }

  private launchMission(index: number): void {
    const mission = MISSIONS[index];
    this.resetSession();
    this.campaignMission = index;
    this.aiPlayer = 'blue';
    this.aiDifficulty = 'normal';
    this.localPlayer = null;
    this.dom.fogToggle.checked = mission.fog;
    this.state = createGame(mission.map, { fog: mission.fog });
    this.ctx = setupCanvas(this.dom.canvas, this.state);
    this.showBanner('red turn', `Mission ${index + 1} — ${mission.name}`, 'red', true);
    this.refresh();
    this.maybeStartAi();
  }

  private showMissionResult(won: boolean): void {
    const index = this.campaignMission;
    if (index === null) return;
    if (won) this.saveCampaignProgress(index + 1);
    const last = index === MISSIONS.length - 1;
    const card = this.dom.campaignContent;
    card.innerHTML = won
      ? last
        ? '<h2>🏆 Campaign complete!</h2><p class="briefing-text">Crossfire Valley is yours. Thanks for playing, Commander.</p>'
        : `<h2>⭐ Mission ${index + 1} complete!</h2><p class="briefing-text">${MISSIONS[index].name} secured.</p>`
      : `<h2>Mission failed</h2><p class="briefing-text">Blue holds ${MISSIONS[index].name}. Regroup and try again.</p>`;

    if (won && !last) {
      const next = document.createElement('button');
      next.className = 'btn primary';
      next.textContent = `Next: ${MISSIONS[index + 1].name}`;
      next.addEventListener('click', () => this.showBriefing(index + 1));
      card.appendChild(next);
    }
    if (!won) {
      const retry = document.createElement('button');
      retry.className = 'btn primary';
      retry.textContent = 'Retry mission';
      retry.addEventListener('click', () => this.launchMission(index));
      card.appendChild(retry);
    }
    const menu = document.createElement('button');
    menu.className = 'btn';
    menu.textContent = 'Mission select';
    menu.addEventListener('click', () => this.openCampaignMenu());
    card.appendChild(menu);
    this.dom.campaignMenu.classList.remove('hidden');
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
        this.dom.modeSelect.value = 'ai';
        this.restart();
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
      }
    }

    const finish = () => {
      this.processEvents(events);
      this.refresh();
      // In PvP, the local turn ending (endTurn or game over) produces the link.
      if (wasLocalTurn && (this.state.winner !== null || this.state.current !== this.localPlayer)) {
        void this.shareTurn();
      }
    };

    if (path && path.length > 1 && cmd.kind === 'move') {
      sfx.move();
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

  private slidePosition(): { unitId: number; x: number; y: number; angle: number } | null {
    const anim = this.anim;
    if (!anim) return null;
    const t = Math.min(1, (performance.now() - anim.start) / anim.duration);
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
    };
  }

  private processEvents(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'damage':
          if (ev.destroyed) {
            sfx.explode();
            this.shake();
          } else {
            sfx.attack();
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
          break;
        case 'built':
          sfx.build();
          break;
        case 'turnStarted': {
          sfx.turn();
          this.history = []; // undo never crosses a turn boundary
          let hint = 'pass the device';
          if (this.aiPlayer !== null) {
            hint = ev.player === this.aiPlayer ? 'computer is thinking…' : 'your move';
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
          if (humanWon) sfx.victory();
          else sfx.defeat();
          this.showBanner(`${ev.winner} wins!`, 'Press Restart to play again', ev.winner, false);
          if (this.campaignMission !== null) {
            // Let the banner land, then show the mission result dialog.
            const token = this.aiToken;
            window.setTimeout(() => {
              if (token === this.aiToken) this.showMissionResult(ev.winner === 'red');
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
    this.dom.stage.classList.remove('shake');
    void (this.dom.stage as HTMLElement).offsetWidth; // restart the CSS animation
    this.dom.stage.classList.add('shake');
    window.setTimeout(() => this.dom.stage.classList.remove('shake'), 350);
  }

  private flashTile(at: { x: number; y: number }): void {
    if (!isVisible(this.state, this.perspective(), at.x, at.y)) return;
    const rect = this.dom.canvas.getBoundingClientRect();
    const scale = rect.width / (this.state.width * TILE);
    const flash = document.createElement('div');
    flash.className = 'hit-flash';
    flash.style.left = `${at.x * TILE * scale}px`;
    flash.style.top = `${at.y * TILE * scale}px`;
    flash.style.width = `${TILE * scale}px`;
    flash.style.height = `${TILE * scale}px`;
    this.dom.stage.appendChild(flash);
    window.setTimeout(() => flash.remove(), 400);
  }

  private spawnDamagePopup(at: { x: number; y: number }, amount: number, destroyed: boolean): void {
    this.spawnTextPopup(at, destroyed ? '💥' : `-${Math.ceil(amount / 10)}`, destroyed);
  }

  private spawnTextPopup(at: { x: number; y: number }, text: string, destroy = false): void {
    // Don't leak combat happening inside the fog.
    if (!isVisible(this.state, this.perspective(), at.x, at.y)) return;
    const rect = this.dom.canvas.getBoundingClientRect();
    const scale = rect.width / (this.state.width * TILE);
    const pop = document.createElement('div');
    pop.className = destroy ? 'dmg-pop destroy' : 'dmg-pop';
    pop.textContent = text;
    pop.style.left = `${(at.x + 0.3) * TILE * scale}px`;
    pop.style.top = `${at.y * TILE * scale}px`;
    this.dom.stage.appendChild(pop);
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
    this.draw();
  }

  private refreshHud(): void {
    const s = this.state;
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
    this.dom.undoBtn.title = s.fog
      ? 'Undo is disabled under fog of war'
      : 'Undo your last move this turn';
  }

  private updateInfoPanels(): void {
    const pos = this.hover;
    if (!pos) {
      this.dom.tileInfo.textContent = 'Hover a tile';
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

  /** Whose vision the fog is rendered from on this device. */
  private perspective(): PlayerId {
    if (this.localPlayer) return this.localPlayer;
    if (this.aiPlayer) return enemyOf(this.aiPlayer);
    return this.state.current; // hotseat: whoever is playing right now
  }

  private draw(): void {
    const ov: Overlays = { hover: this.hover ?? undefined, slide: this.slidePosition() ?? undefined };
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
        this.state.units
          .filter((u) => !canSeeUnit(this.state, viewer, u, fog))
          .map((u) => u.id),
      );
    }
    render(this.ctx, this.state, ov, fog, this.facings);
  }
}
