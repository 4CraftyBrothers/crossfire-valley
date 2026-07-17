import { attackableTargets, computeDamage, isIndirect } from '../engine/combat';
import { CAPTURE_POINTS, TERRAIN_DATA, UNIT_DATA } from '../engine/data';
import { canCaptureAt } from '../engine/game';
import { manhattan, reachableTiles } from '../engine/movement';
import { inBounds, tileAt, unitAt, visualHp } from '../engine/state';
import type { Command, GameState, MoveClass, PlayerId, Unit, UnitType } from '../engine/types';

/**
 * Returns the next command for the side whose turn it is. Call repeatedly
 * (applying each command) until it returns endTurn. Pure and synchronous:
 * evaluates every legal (unit, destination, action) triple, scores it in
 * rough "funds value" units, and greedily plays the best one. Units act
 * first, then factories build, then the turn ends.
 */
export function nextAiCommand(state: GameState): Command {
  const ready = state.units.filter((u) => u.owner === state.current && !u.acted);
  if (ready.length > 0) return bestUnitCommand(state, ready);
  const build = chooseBuildCommand(state);
  if (build) return build;
  return { kind: 'endTurn' };
}

interface Candidate {
  score: number;
  cmd: Command;
}

function bestUnitCommand(state: GameState, ready: Unit[]): Command {
  const ai = state.current;
  const enemies = state.units.filter((u) => u.owner !== ai);
  const fields = new FieldCache(state, ai, enemies);

  let best: Candidate | null = null;
  const consider = (score: number, cmd: Command) => {
    if (!best || score > best.score) best = { score, cmd };
  };

  for (const unit of ready) {
    const reach = reachableTiles(state, unit);
    const goalField = fields.goalFieldFor(unit);

    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      const moved = x !== unit.x || y !== unit.y;
      const stars = TERRAIN_DATA[tileAt(state, x, y).terrain].defenseStars;

      consider(positionalScore(state, unit, x, y, stars, goalField, enemies), {
        kind: 'move',
        unitId: unit.id,
        to: { x, y },
        action: { type: 'wait' },
      });

      if (canCaptureAt(state, unit, x, y)) {
        consider(captureScore(state, unit, x, y, moved), {
          kind: 'move',
          unitId: unit.id,
          to: { x, y },
          action: { type: 'capture' },
        });
      }

      for (const target of attackableTargets(state, unit, x, y, moved)) {
        consider(attackScore(state, unit, target, x, y, stars), {
          kind: 'move',
          unitId: unit.id,
          to: { x, y },
          action: { type: 'attack', targetId: target.id },
        });
      }
    }
  }

  // Every ready unit can at least wait in place, so best is always set.
  return best!.cmd;
}

// ----- scoring -------------------------------------------------------------

function positionalScore(
  state: GameState,
  unit: Unit,
  x: number,
  y: number,
  stars: number,
  goalField: number[],
  enemies: Unit[],
): number {
  const travel = Math.min(goalField[y * state.width + x] ?? Infinity, 40);
  let score = 200 - 12 * (Number.isFinite(travel) ? travel : 40) + 6 * stars;

  // Don't clog our own factories.
  const tile = tileAt(state, x, y);
  if (tile.terrain === 'factory' && tile.owner === unit.owner) score -= 40;

  // Indirect units keep their distance so they can fire next turn.
  if (isIndirect(unit) && enemies.length > 0) {
    const nearest = Math.min(...enemies.map((e) => manhattan(x, y, e.x, e.y)));
    if (nearest < 2) score -= 80;
    if (nearest >= 2 && nearest <= UNIT_DATA[unit.type].maxRange + 1) score += 40;
  }

  return score;
}

function captureScore(state: GameState, unit: Unit, x: number, y: number, moved: boolean): number {
  const tile = tileAt(state, x, y);
  const continuing = !moved && tile.capturingUnitId === unit.id;
  const remaining = continuing ? tile.capturePoints : CAPTURE_POINTS;
  const completes = remaining - visualHp(unit) <= 0;

  if (tile.terrain === 'hq' && completes) return 1_000_000; // wins the game
  let score = tile.terrain === 'hq' ? 5000 : 2500;
  // Finishing a capture we already started beats starting a new one.
  if (continuing) score += 2000;
  if (completes) score += 1500;
  if (tile.owner !== null) score += 800; // stealing enemy income is double value
  return score;
}

function attackScore(
  state: GameState,
  unit: Unit,
  target: Unit,
  x: number,
  y: number,
  destStars: number,
): number {
  const dmg = computeDamage(state, unit, target);
  const kill = dmg >= target.hp;
  const targetCost = UNIT_DATA[target.type].cost;

  let counter = 0;
  if (!kill && !isIndirect(unit) && !isIndirect(target) && manhattan(x, y, target.x, target.y) === 1) {
    counter = computeDamage(state, { ...target, hp: target.hp - dmg }, { ...unit, x, y });
  }

  let score =
    (dmg / 100) * targetCost -
    0.75 * (counter / 100) * UNIT_DATA[unit.type].cost +
    destStars * 15;
  if (kill) score += 400 + 0.3 * targetCost;

  // Interrupt enemy captures, urgently if it's our HQ.
  for (const tile of state.tiles) {
    if (tile.capturingUnitId === target.id) {
      score += tile.terrain === 'hq' && tile.owner === unit.owner ? 2000 : 400;
    }
  }

  return score;
}

// ----- movement goals ------------------------------------------------------

/**
 * Lazily-computed Dijkstra distance fields (terrain cost, units ignored).
 * Foot units head for the nearest capturable property; everyone else heads
 * for the enemy army.
 */
class FieldCache {
  private cache = new Map<string, number[]>();

  constructor(
    private state: GameState,
    private ai: PlayerId,
    private enemies: Unit[],
  ) {}

  goalFieldFor(unit: Unit): number[] {
    const data = UNIT_DATA[unit.type];
    if (data.canCapture) {
      const targets = this.captureTargets();
      if (targets.length > 0) return this.field(`cap-${data.moveClass}`, data.moveClass, targets);
    }
    const enemyPos = this.enemies.map((e) => ({ x: e.x, y: e.y }));
    return this.field(`enemy-${data.moveClass}`, data.moveClass, enemyPos);
  }

  private captureTargets(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < this.state.height; y++) {
      for (let x = 0; x < this.state.width; x++) {
        const tile = tileAt(this.state, x, y);
        if (TERRAIN_DATA[tile.terrain].capturable && tile.owner !== this.ai) out.push({ x, y });
      }
    }
    return out;
  }

  private field(cacheKey: string, moveClass: MoveClass, sources: { x: number; y: number }[]): number[] {
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;
    const result = distanceField(this.state, moveClass, sources);
    this.cache.set(cacheKey, result);
    return result;
  }
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Multi-source Dijkstra over terrain movement costs, ignoring units. */
export function distanceField(
  state: GameState,
  moveClass: MoveClass,
  sources: { x: number; y: number }[],
): number[] {
  const dist = new Array<number>(state.width * state.height).fill(Infinity);
  const frontier: { x: number; y: number; cost: number }[] = [];
  for (const s of sources) {
    dist[s.y * state.width + s.x] = 0;
    frontier.push({ x: s.x, y: s.y, cost: 0 });
  }

  while (frontier.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[bestIdx].cost) bestIdx = i;
    }
    const { x, y, cost } = frontier.splice(bestIdx, 1)[0];
    if (cost > dist[y * state.width + x]) continue;

    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(state, nx, ny)) continue;
      const step = TERRAIN_DATA[tileAt(state, nx, ny).terrain].moveCost[moveClass];
      if (step === null) continue;
      const total = cost + step;
      const idx = ny * state.width + nx;
      if (total < dist[idx]) {
        dist[idx] = total;
        frontier.push({ x: nx, y: ny, cost: total });
      }
    }
  }

  return dist;
}

// ----- building ------------------------------------------------------------

function chooseBuildCommand(state: GameState): Command | null {
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = tileAt(state, x, y);
      if (tile.terrain !== 'factory' || tile.owner !== state.current) continue;
      if (unitAt(state, x, y)) continue;
      const unitType = chooseBuildType(state);
      if (!unitType) return null; // can't afford anything worth building
      return { kind: 'build', at: { x, y }, unitType };
    }
  }
  return null;
}

function chooseBuildType(state: GameState): UnitType | null {
  const ai = state.current;
  const funds = state.funds[ai];
  const mine = state.units.filter((u) => u.owner === ai);
  const foot = mine.filter((u) => UNIT_DATA[u.type].canCapture).length;
  const artillery = mine.filter((u) => u.type === 'artillery').length;
  const tanks = mine.filter((u) => u.type === 'lightTank' || u.type === 'heavyTank').length;

  const capturablesLeft = state.tiles.filter(
    (t) => TERRAIN_DATA[t.terrain].capturable && t.owner !== ai,
  ).length;

  // Keep enough foot soldiers to win the income war.
  if (foot < Math.min(4, capturablesLeft) && funds >= UNIT_DATA.infantry.cost) {
    return foot >= 2 && funds >= UNIT_DATA.bazooka.cost ? 'bazooka' : 'infantry';
  }

  if (funds >= UNIT_DATA.heavyTank.cost) return 'heavyTank';
  if (funds >= UNIT_DATA.lightTank.cost) return 'lightTank';
  if (funds >= UNIT_DATA.artillery.cost && artillery <= tanks) return 'artillery';
  if (funds >= UNIT_DATA.recon.cost && state.day <= 4) return 'recon';
  if (funds >= UNIT_DATA.bazooka.cost) return 'bazooka';
  if (funds >= UNIT_DATA.infantry.cost) return 'infantry';
  return null;
}
