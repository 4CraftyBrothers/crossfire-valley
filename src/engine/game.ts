import { CLOAK_STRIKE, attackableTargets, canCounter, computeDamage, strikesFromCloak } from './combat';
import {
  BUILD_SITES,
  CAPTURE_POINTS,
  DAMAGE,
  MAX_HP,
  REPAIR_PER_TURN,
  TERRAIN_DATA,
  UNIT_DATA,
  builtAt,
  modsOf,
} from './data';
import { canCarry, key, manhattan, pathBetween, reachableTiles } from './movement';
import { enemyOf, inBounds, incomeFor, propertiesOwned, tileAt, unitAt, unitById, unitCost, visualHp } from './state';
import { canSeeUnit, isAir, isCloaked } from './vision';
import type {
  Command,
  CommandResult,
  GameEvent,
  GameState,
  PlayerId,
  Tile,
  Unit,
} from './types';

/**
 * Applies a command to the game state, returning the new state and the
 * events that occurred. Never mutates the input state. Throws on illegal
 * commands — the UI should only offer legal ones.
 */
export function applyCommand(prev: GameState, cmd: Command): CommandResult {
  if (prev.winner) throw new Error('Game is over');
  const state = structuredClone(prev);
  const events: GameEvent[] = [];

  switch (cmd.kind) {
    case 'move':
      applyMove(state, cmd, events);
      break;
    case 'build':
      applyBuild(state, cmd, events);
      break;
    case 'upgrade':
      applyUpgrade(state, cmd, events);
      break;
    case 'endTurn':
      startTurn(state, enemyOf(state.current), events);
      break;
  }

  return { state, events };
}

function applyMove(state: GameState, cmd: Extract<Command, { kind: 'move' }>, events: GameEvent[]): void {
  const unit = unitById(state, cmd.unitId);
  if (!unit) throw new Error('No such unit');
  if (unit.owner !== state.current) throw new Error('Not your unit');
  if (unit.acted) throw new Error('Unit has already acted');

  const from = { x: unit.x, y: unit.y };
  const moved = cmd.to.x !== from.x || cmd.to.y !== from.y;
  let action = cmd.action;

  // Decided before moving: once adjacent to its target it is found anyway.
  const fromCloak = strikesFromCloak(state, unit);
  let blocker: Unit | undefined;

  // Boarding: the destination is a friendly transport's tile.
  const loading = action.type === 'load';
  const transport = loading ? unitAt(state, cmd.to.x, cmd.to.y) : undefined;
  if (loading && (!moved || !transport || !canCarry(transport, unit))) throw new Error('Cannot board that');
  let boarding = false;

  if (moved) {
    if (loading) {
      if (!pathBetween(state, unit, cmd.to)) throw new Error('Destination not reachable');
    } else {
      const reachable = reachableTiles(state, unit);
      if (!reachable.has(key(cmd.to.x, cmd.to.y))) throw new Error('Destination not reachable');
    }
    const path = pathBetween(state, unit, cmd.to)!;

    // Hidden enemies on the route spring an ambush: the unit stops short
    // and loses its action. Aircraft fly over everything but still can't
    // land on an occupied tile.
    const air = UNIT_DATA[unit.type].moveClass === 'air';
    let stop = path.length - 1;
    let ambushed = false;
    if (!air) {
      for (let i = 1; i < path.length - 1; i++) {
        const occ = unitAt(state, path[i].x, path[i].y);
        if (occ && occ.owner !== unit.owner) {
          stop = i - 1;
          ambushed = true;
          blocker = occ;
          break;
        }
      }
    }
    if (!ambushed && !loading) {
      const occ = unitAt(state, path[stop].x, path[stop].y);
      if (occ && occ.id !== unit.id) {
        stop -= 1;
        ambushed = true;
        if (occ.owner !== unit.owner) blocker = occ;
      }
    }
    boarding = loading && !ambushed;
    // Never end on a pass-through tile someone else holds (unless boarding it).
    while (stop > 0 && !boarding) {
      const occ = unitAt(state, path[stop].x, path[stop].y);
      if (occ && occ.id !== unit.id) stop -= 1;
      else break;
    }

    // Leaving a tile abandons any capture in progress there.
    resetCaptureBy(state, unit.id);
    const dest = path[stop];
    unit.x = dest.x;
    unit.y = dest.y;
    events.push({ type: 'moved', unitId: unit.id, from, to: { ...dest } });
    if (ambushed) {
      events.push({ type: 'ambushed', unitId: unit.id, at: { ...dest } });
      action = { type: 'wait' };
      // Trackers fight back when they bump into a cloaked unit.
      if (blocker && isCloaked(blocker) && modsOf(unit.type).tracking && attackableTargets(state, unit, dest.x, dest.y, false).some((t) => t.id === blocker!.id)) {
        action = { type: 'attack', targetId: blocker.id };
      }
    }
  }

  if (boarding && transport) {
    state.units = state.units.filter((u) => u.id !== unit.id);
    unit.acted = true;
    transport.cargo = [...(transport.cargo ?? []), unit];
    events.push({ type: 'loaded', unitId: unit.id, transportId: transport.id });
    return;
  }

  let extraAction = false;
  switch (action.type) {
    case 'wait':
    case 'load': // an ambush cut the boarding short
      break;
    case 'unload':
      applyUnload(state, unit, action.drops, events);
      break;
    case 'capture':
      applyCapture(state, unit, events);
      break;
    case 'attack':
      extraAction = applyAttack(state, unit, action.targetId, moved && !(blocker && isCloaked(blocker) && modsOf(unit.type).tracking), events, fromCloak);
      break;
  }

  unit.acted = !extraAction;
}

/** Tiles next to (x, y) where this passenger could be set down right now. */
export function dropTiles(state: GameState, transport: Unit, passenger: Unit, x: number, y: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(state, nx, ny)) continue;
    if (TERRAIN_DATA[tileAt(state, nx, ny).terrain].moveCost[UNIT_DATA[passenger.type].moveClass] === null) continue;
    const occ = unitAt(state, nx, ny);
    // The transport's own starting tile is free once it has moved away.
    if (occ && occ.id !== transport.id && canSeeUnit(state, transport.owner, occ)) continue;
    out.push({ x: nx, y: ny });
  }
  return out;
}

function applyUnload(
  state: GameState,
  transport: Unit,
  drops: { unitId: number; at: { x: number; y: number } }[],
  events: GameEvent[],
): void {
  if (!transport.cargo?.length) throw new Error('Nothing to unload');
  if (drops.length === 0) throw new Error('No drops given');
  const used = new Set<string>();
  for (const drop of drops) {
    const idx = transport.cargo.findIndex((c) => c.id === drop.unitId);
    if (idx < 0) throw new Error('Not in this transport');
    const passenger = transport.cargo[idx];
    const { x, y } = drop.at;
    if (manhattan(transport.x, transport.y, x, y) !== 1 || !inBounds(state, x, y)) {
      throw new Error('Drops go next to the transport');
    }
    if (used.has(key(x, y))) throw new Error('Two drops on one tile');
    if (TERRAIN_DATA[tileAt(state, x, y).terrain].moveCost[UNIT_DATA[passenger.type].moveClass] === null) {
      throw new Error('That unit cannot stand there');
    }
    const occ = unitAt(state, x, y);
    if (occ) {
      // A hidden enemy nobody could see blocks the drop, like an ambush.
      if (occ.owner !== transport.owner && !canSeeUnit(state, transport.owner, occ)) {
        events.push({ type: 'ambushed', unitId: passenger.id, at: { x, y } });
        continue;
      }
      throw new Error('Drop tile occupied');
    }
    used.add(key(x, y));
    transport.cargo.splice(idx, 1);
    passenger.x = x;
    passenger.y = y;
    passenger.acted = true; // set down this turn, moves next turn
    state.units.push(passenger);
    events.push({ type: 'unloaded', unitId: passenger.id, transportId: transport.id, at: { x, y } });
  }
  if (transport.cargo.length === 0) delete transport.cargo;
}

/** Ships capture properties at sea (oil rigs); everyone else captures on land. */
function captureDomainOk(unit: Unit, tile: Tile): boolean {
  return (UNIT_DATA[unit.type].domain === 'sea') === (TERRAIN_DATA[tile.terrain].domain === 'sea');
}

function applyCapture(state: GameState, unit: Unit, events: GameEvent[]): void {
  if (!UNIT_DATA[unit.type].canCapture) throw new Error('Unit cannot capture');
  const tile = tileAt(state, unit.x, unit.y);
  if (!TERRAIN_DATA[tile.terrain].capturable) throw new Error('Tile not capturable');
  if (!captureDomainOk(unit, tile)) throw new Error('Unit cannot capture that');
  if (tile.owner === unit.owner) throw new Error('Already owned');

  if (tile.capturingUnitId !== unit.id) {
    tile.capturePoints = CAPTURE_POINTS;
    tile.capturingUnitId = unit.id;
  }
  tile.capturePoints -= visualHp(unit);

  if (tile.capturePoints <= 0) {
    const wasHq = tile.terrain === 'hq';
    tile.owner = unit.owner;
    tile.capturePoints = CAPTURE_POINTS;
    tile.capturingUnitId = null;
    events.push({ type: 'captured', at: { x: unit.x, y: unit.y }, by: unit.owner });
    if (wasHq) {
      state.winner = unit.owner;
      events.push({ type: 'victory', winner: unit.owner });
    } else if (
      unit.owner === 'red' &&
      state.objective?.kind === 'capture' &&
      propertiesOwned(state, 'red') >= state.objective.count
    ) {
      state.winner = 'red';
      events.push({ type: 'victory', winner: 'red' });
    }
  } else {
    events.push({
      type: 'captureProgress',
      at: { x: unit.x, y: unit.y },
      remaining: tile.capturePoints,
    });
  }
}

function applyAttack(
  state: GameState,
  attacker: Unit,
  targetId: number,
  moved: boolean,
  events: GameEvent[],
  fromCloak = false,
): boolean {
  const target = unitById(state, targetId);
  if (!target) throw new Error('No such target');
  const legal = attackableTargets(state, attacker, attacker.x, attacker.y, moved);
  if (!legal.some((t) => t.id === targetId)) throw new Error('Target not in range');

  const mods = modsOf(attacker.type);
  const targetPos = { x: target.x, y: target.y };
  dealDamage(state, attacker, target, events, false, fromCloak ? CLOAK_STRIKE : 1);
  // Firing gives a cloaked unit away until its owner's next turn.
  if (modsOf(attacker.type).cloak) attacker.revealed = true;

  if (target.hp > 0 && canCounter(attacker, target)) {
    dealDamage(state, target, attacker, events, true);
  }

  // Piercing: the enemy directly behind the target, on the line of fire,
  // takes a share of the same hit.
  if (mods.piercing && attacker.hp > 0) {
    const dx = Math.sign(targetPos.x - attacker.x);
    const dy = Math.sign(targetPos.y - attacker.y);
    if ((dx === 0) !== (dy === 0)) {
      const behind = unitAt(state, targetPos.x + dx, targetPos.y + dy);
      if (behind && behind.owner !== attacker.owner && DAMAGE[attacker.type][behind.type] > 0) {
        applyHit(state, behind, Math.round(computeDamage(state, attacker, behind) * mods.piercing), events);
      }
    }
  }

  // Scavenge: a kill earns one more action, once per turn.
  let extraAction = false;
  if (mods.scavenge && !attacker.scavenged && !unitById(state, targetId)) {
    attacker.scavenged = true;
    extraAction = true;
  }

  checkRout(state, events);
  return extraAction;
}

function dealDamage(state: GameState, attacker: Unit, defender: Unit, events: GameEvent[], counter = false, bonus = 1): void {
  applyHit(state, defender, Math.round(computeDamage(state, attacker, defender, counter) * bonus), events);
}

function applyHit(state: GameState, defender: Unit, amount: number, events: GameEvent[]): void {
  defender.hp = Math.max(0, defender.hp - amount);
  const destroyed = defender.hp === 0;
  events.push({
    type: 'damage',
    targetId: defender.id,
    at: { x: defender.x, y: defender.y },
    amount,
    destroyed,
  });
  if (destroyed) {
    resetCaptureBy(state, defender.id);
    state.units = state.units.filter((u) => u.id !== defender.id);
  }
}

function checkRout(state: GameState, events: GameEvent[]): void {
  if (state.winner) return;
  for (const player of ['red', 'blue'] as PlayerId[]) {
    if (!state.units.some((u) => u.owner === player)) {
      state.winner = enemyOf(player);
      events.push({ type: 'victory', winner: state.winner });
      return;
    }
  }
}

function applyBuild(state: GameState, cmd: Extract<Command, { kind: 'build' }>, events: GameEvent[]): void {
  const tile = tileAt(state, cmd.at.x, cmd.at.y);
  if (!BUILD_SITES.includes(tile.terrain)) throw new Error('Not a factory');
  if (tile.owner !== state.current) throw new Error('Not your factory');
  if (!builtAt(cmd.unitType).includes(tile.terrain)) throw new Error('Cannot build that here');
  if (state.roster && !state.roster.includes(cmd.unitType)) throw new Error('Not available in this game');
  if (unitAt(state, cmd.at.x, cmd.at.y)) throw new Error('Factory occupied');
  const cost = unitCost(state, state.current, cmd.unitType);
  if (state.funds[state.current] < cost) throw new Error('Insufficient funds');

  state.funds[state.current] -= cost;
  const unit: Unit = {
    id: state.nextUnitId++,
    type: cmd.unitType,
    owner: state.current,
    x: cmd.at.x,
    y: cmd.at.y,
    hp: MAX_HP,
    acted: true, // fresh units deploy next turn
  };
  state.units.push(unit);
  events.push({ type: 'built', unitId: unit.id, at: { ...cmd.at } });
}

/** The next upgrade for an owned property at (x, y), if there is one. */
export function nextUpgrade(state: GameState, x: number, y: number): { cost: number; income: number; level: number } | null {
  const tile = tileAt(state, x, y);
  const ups = TERRAIN_DATA[tile.terrain].upgrades;
  const level = tile.level ?? 1;
  if (!ups || tile.owner !== state.current || level > ups.length) return null;
  return { ...ups[level - 1], level: level + 1 };
}

function applyUpgrade(state: GameState, cmd: Extract<Command, { kind: 'upgrade' }>, events: GameEvent[]): void {
  const up = nextUpgrade(state, cmd.at.x, cmd.at.y);
  if (!up) throw new Error('Nothing to upgrade here');
  if (state.funds[state.current] < up.cost) throw new Error('Insufficient funds');
  state.funds[state.current] -= up.cost;
  tileAt(state, cmd.at.x, cmd.at.y).level = up.level;
  events.push({ type: 'upgraded', at: { ...cmd.at }, level: up.level });
}

function startTurn(state: GameState, player: PlayerId, events: GameEvent[]): void {
  state.current = player;
  if (player === 'red') state.day += 1;

  const income = incomeFor(state, player);
  state.funds[player] += income;

  for (const unit of state.units) {
    if (unit.owner !== player) continue;
    unit.acted = false;
    unit.scavenged = false;
    unit.revealed = false;
    const tile = tileAt(state, unit.x, unit.y);
    if (TERRAIN_DATA[tile.terrain].capturable && tile.owner === player) {
      unit.hp = Math.min(MAX_HP, unit.hp + REPAIR_PER_TURN);
    }
    const heal = modsOf(unit.type).heal;
    if (heal) unit.hp = Math.min(MAX_HP, unit.hp + heal);
  }

  // Hazard terrain bites everyone who starts a turn on it, aircraft excepted.
  let hazardKill = false;
  for (const unit of [...state.units]) {
    if (unit.owner !== player || isAir(unit)) continue;
    const hazard = TERRAIN_DATA[tileAt(state, unit.x, unit.y).terrain].hazard;
    if (!hazard) continue;
    applyHit(state, unit, hazard, events);
    if (unit.hp === 0) hazardKill = true;
  }
  if (hazardKill) checkRout(state, events);

  events.push({ type: 'turnStarted', player, day: state.day, income });

  if (player === 'red' && state.objective?.kind === 'survive' && state.day >= state.objective.day) {
    state.winner = 'red';
    events.push({ type: 'victory', winner: 'red' });
  }
}

function resetCaptureBy(state: GameState, unitId: number): void {
  for (const tile of state.tiles) {
    if (tile.capturingUnitId === unitId) {
      tile.capturePoints = CAPTURE_POINTS;
      tile.capturingUnitId = null;
    }
  }
}

/** Factory tiles where the current player can build right now. */
export function canBuildAt(state: GameState, x: number, y: number): boolean {
  const tile: Tile = tileAt(state, x, y);
  return BUILD_SITES.includes(tile.terrain) && tile.owner === state.current && !unitAt(state, x, y);
}

/** Whether this unit could capture the tile at (x, y). */
export function canCaptureAt(state: GameState, unit: Unit, x: number, y: number): boolean {
  if (!UNIT_DATA[unit.type].canCapture) return false;
  const tile = tileAt(state, x, y);
  return TERRAIN_DATA[tile.terrain].capturable && tile.owner !== unit.owner && captureDomainOk(unit, tile);
}
