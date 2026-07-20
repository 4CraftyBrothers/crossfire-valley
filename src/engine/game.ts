import { attackableTargets, canCounter, computeDamage } from './combat';
import {
  CAPTURE_POINTS,
  INCOME_PER_PROPERTY,
  MAX_HP,
  REPAIR_PER_TURN,
  TERRAIN_DATA,
  UNIT_DATA,
} from './data';
import { key, pathBetween, reachableTiles } from './movement';
import { enemyOf, tileAt, unitAt, unitById, visualHp } from './state';
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

  if (moved) {
    const reachable = reachableTiles(state, unit);
    if (!reachable.has(key(cmd.to.x, cmd.to.y))) throw new Error('Destination not reachable');
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
          break;
        }
      }
    }
    if (!ambushed) {
      const occ = unitAt(state, path[stop].x, path[stop].y);
      if (occ && occ.id !== unit.id) {
        stop -= 1;
        ambushed = true;
      }
    }
    // Never end on a pass-through tile someone else holds.
    while (stop > 0) {
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
    }
  }

  switch (action.type) {
    case 'wait':
      break;
    case 'capture':
      applyCapture(state, unit, events);
      break;
    case 'attack':
      applyAttack(state, unit, action.targetId, moved, events);
      break;
  }

  unit.acted = true;
}

function applyCapture(state: GameState, unit: Unit, events: GameEvent[]): void {
  if (!UNIT_DATA[unit.type].canCapture) throw new Error('Unit cannot capture');
  const tile = tileAt(state, unit.x, unit.y);
  if (!TERRAIN_DATA[tile.terrain].capturable) throw new Error('Tile not capturable');
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
): void {
  const target = unitById(state, targetId);
  if (!target) throw new Error('No such target');
  const legal = attackableTargets(state, attacker, attacker.x, attacker.y, moved);
  if (!legal.some((t) => t.id === targetId)) throw new Error('Target not in range');

  dealDamage(state, attacker, target, events);

  if (target.hp > 0 && canCounter(attacker, target)) {
    dealDamage(state, target, attacker, events);
  }

  checkRout(state, events);
}

function dealDamage(state: GameState, attacker: Unit, defender: Unit, events: GameEvent[]): void {
  const amount = computeDamage(state, attacker, defender);
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
  if (tile.terrain !== 'factory') throw new Error('Not a factory');
  if (tile.owner !== state.current) throw new Error('Not your factory');
  if (unitAt(state, cmd.at.x, cmd.at.y)) throw new Error('Factory occupied');
  const cost = UNIT_DATA[cmd.unitType].cost;
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

function startTurn(state: GameState, player: PlayerId, events: GameEvent[]): void {
  state.current = player;
  if (player === 'red') state.day += 1;

  let income = 0;
  for (const tile of state.tiles) {
    if (TERRAIN_DATA[tile.terrain].capturable && tile.owner === player) {
      income += INCOME_PER_PROPERTY;
    }
  }
  state.funds[player] += income;

  for (const unit of state.units) {
    if (unit.owner !== player) continue;
    unit.acted = false;
    const tile = tileAt(state, unit.x, unit.y);
    if (TERRAIN_DATA[tile.terrain].capturable && tile.owner === player) {
      unit.hp = Math.min(MAX_HP, unit.hp + REPAIR_PER_TURN);
    }
  }

  events.push({ type: 'turnStarted', player, day: state.day, income });
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
  return tile.terrain === 'factory' && tile.owner === state.current && !unitAt(state, x, y);
}

/** Whether this unit could capture the tile at (x, y). */
export function canCaptureAt(state: GameState, unit: Unit, x: number, y: number): boolean {
  if (!UNIT_DATA[unit.type].canCapture) return false;
  const tile = tileAt(state, x, y);
  return TERRAIN_DATA[tile.terrain].capturable && tile.owner !== unit.owner;
}
