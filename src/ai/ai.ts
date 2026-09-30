import { attackableTargets, computeDamage, isIndirect } from '../engine/combat';
import { BUILD_SITES, CAPTURE_POINTS, DAMAGE, TERRAIN_DATA, UNIT_DATA, modsOf } from '../engine/data';
import { canCaptureAt, constructorCanBuild, dropTiles, nextUpgrade } from '../engine/game';
import { boardableTransports, canCarry, manhattan, reachableTiles } from '../engine/movement';
import { inBounds, tileAt, unitAt, visualHp } from '../engine/state';
import { canSeeUnit, visibleTiles } from '../engine/vision';
import type { Command, GameState, MoveClass, PlayerId, Unit, UnitType } from '../engine/types';

export type AiDifficulty = 'easy' | 'normal' | 'hard';

/**
 * Returns the next command for the side whose turn it is. Call repeatedly
 * (applying each command) until it returns endTurn. Pure and synchronous
 * (easy mode adds score noise, so only 'normal'/'hard' are deterministic):
 * evaluates every legal (unit, destination, action) triple, scores it in
 * rough "funds value" units, and greedily plays the best one. Units act
 * first, then factories build, then the turn ends.
 */
export function nextAiCommand(state: GameState, difficulty: AiDifficulty = 'normal'): Command {
  // A Warmachine settled on ore builds before anything moves (building is its turn).
  const construct = chooseConstructorBuild(state, difficulty);
  if (construct) return construct;
  const ready = state.units.filter((u) => u.owner === state.current && !u.acted);
  if (ready.length > 0) return bestUnitCommand(state, ready, difficulty);
  const build = chooseBuildCommand(state, difficulty);
  if (build) return build;
  const upgrade = chooseUpgrade(state, difficulty);
  if (upgrade) return upgrade;
  return { kind: 'endTurn' };
}

interface Candidate {
  score: number;
  cmd: Command;
}

function bestUnitCommand(state: GameState, ready: Unit[], difficulty: AiDifficulty): Command {
  const ai = state.current;
  // Play fair: the AI only knows about enemies its own side can see
  // (fog, forest hiding, and cloaks).
  const sight = state.fog ? visibleTiles(state, ai) : undefined;
  const enemies = state.units.filter((u) => u.owner !== ai && canSeeUnit(state, ai, u, sight));
  const fields = new FieldCache(state, ai, enemies);
  const caution = threatWeight(state, ai, enemies, difficulty);

  let best: Candidate | null = null;
  const consider = (score: number, cmd: Command) => {
    // Easy mode misjudges: heavy noise makes it pick decent-but-not-best
    // moves and occasionally pass up good attacks.
    if (difficulty === 'easy') score += (Math.random() - 0.5) * 600;
    if (!best || score > best.score) best = { score, cmd };
  };

  for (const unit of ready) {
    if (UNIT_DATA[unit.type].mods?.transport) {
      considerTransport(state, unit, fields, enemies, caution, consider);
      continue;
    }
    const reach = reachableTiles(state, unit);
    const goalField = fields.goalFieldFor(unit);

    // No land route to anything worth doing: ride a transport if one is in reach.
    if (!Number.isFinite(goalField[unit.y * state.width + unit.x])) {
      for (const t of boardableTransports(state, unit)) {
        consider(700, { kind: 'move', unitId: unit.id, to: { x: t.x, y: t.y }, action: { type: 'load' } });
      }
    }

    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      const moved = x !== unit.x || y !== unit.y;
      const stars = TERRAIN_DATA[tileAt(state, x, y).terrain].defenseStars;
      // A linchpin (Warmachine) is the whole game: guard it three times as hard.
      const guard = modsOf(unit.type).linchpin ? 3 : 1;
      const danger = caution === 0 ? 0 : guard * caution * threatAt(state, unit, x, y, enemies);

      consider(positionalScore(state, unit, x, y, stars, goalField, enemies) - danger, {
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
        let score = attackScore(state, unit, target, x, y, stars);
        // Hard mode focus-fires: finishing wounded units beats spreading damage.
        if (difficulty === 'hard' && target.hp <= 50) {
          score += 0.2 * UNIT_DATA[target.type].cost;
        }
        // Firing from an exposed tile still leaves the unit there afterwards;
        // a kill removes that target from next turn's threats.
        if (caution > 0) {
          const kill = computeDamage(state, unit, target) >= target.hp;
          score -= caution * threatAt(state, unit, x, y, enemies, kill ? target.id : undefined);
        }
        consider(score, {
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

// ----- transports ------------------------------------------------------------

/**
 * Loaded: head for where the passengers want to be and set them down there.
 * Empty: go and fetch a friendly unit that has no land route; otherwise
 * stay out of harm's way.
 */
function considerTransport(
  state: GameState,
  unit: Unit,
  fields: FieldCache,
  enemies: Unit[],
  caution: number,
  consider: (score: number, cmd: Command) => void,
): void {
  const cargo = unit.cargo ?? [];
  const passengerFields = cargo.map((p) => fields.goalFieldFor(p));
  const stranded =
    cargo.length === 0
      ? state.units.filter(
          (f) => f.owner === unit.owner && canCarry(unit, f) && !Number.isFinite(fields.goalFieldFor(f)[f.y * state.width + f.x]),
        )
      : [];
  const at = (field: number[], x: number, y: number) => field[y * state.width + x] ?? Infinity;
  const landing = cargo.length > 0 ? landingField(state, unit, cargo[0], passengerFields[0]) : null;

  for (const k of reachableTiles(state, unit).keys()) {
    const [x, y] = k.split(',').map(Number);
    const moved = x !== unit.x || y !== unit.y;
    // Losing a loaded transport loses its passengers too.
    const danger = caution === 0 ? 0 : caution * threatAt(state, unit, x, y, enemies) * (1 + cargo.length);
    const wait: Command = { kind: 'move', unitId: unit.id, to: { x, y }, action: { type: 'wait' } };

    if (cargo.length > 0) {
      // Greedy drops: each passenger takes the free neighbour closest to its goal.
      const used = new Set<string>();
      const drops: { unitId: number; at: { x: number; y: number } }[] = [];
      let total = 0;
      cargo.forEach((p, i) => {
        let bestTile: { x: number; y: number } | null = null;
        let bestDist = Infinity;
        for (const t of dropTiles(state, unit, p, x, y)) {
          const d = at(passengerFields[i], t.x, t.y);
          if (!used.has(`${t.x},${t.y}`) && d < bestDist) {
            bestDist = d;
            bestTile = t;
          }
        }
        if (bestTile && Number.isFinite(bestDist)) {
          used.add(`${bestTile.x},${bestTile.y}`);
          drops.push({ unitId: p.id, at: bestTile });
          total += bestDist;
        }
      });
      if (drops.length > 0) {
        consider(900 - 15 * total - danger, { kind: 'move', unitId: unit.id, to: { x, y }, action: { type: 'unload', drops } });
      }
      // Otherwise head for the nearest spot where the passengers could land
      // and still reach their goal.
      consider(150 - 12 * Math.min(at(landing!, x, y), 40) - danger, wait);
    } else if (stranded.length > 0) {
      const nearest = Math.min(...stranded.map((f) => manhattan(x, y, f.x, f.y)));
      consider(150 - 12 * Math.min(nearest, 40) - danger, wait);
    } else {
      consider((moved ? -50 : 0) - danger, wait);
    }
  }
}

/**
 * Distance, for the transport, to any tile it can stop on that sits next to
 * ground from which the passenger can reach its goal.
 */
function landingField(state: GameState, transport: Unit, passenger: Unit, passengerField: number[]): number[] {
  const tClass = UNIT_DATA[transport.type].moveClass;
  const pClass = UNIT_DATA[passenger.type].moveClass;
  const sources: { x: number; y: number }[] = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (TERRAIN_DATA[tileAt(state, x, y).terrain].moveCost[tClass] === null) continue;
      const lands = DIRS.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(state, nx, ny)) return false;
        if (TERRAIN_DATA[tileAt(state, nx, ny).terrain].moveCost[pClass] === null) return false;
        return Number.isFinite(passengerField[ny * state.width + nx]);
      });
      if (lands) sources.push({ x, y });
    }
  }
  return distanceField(state, tClass, sources);
}

// ----- scoring -------------------------------------------------------------

/**
 * How much the AI cares about ending a move where the enemy can hit it.
 * Easy charges blindly; hard is careful enough to hold formation and let
 * the other side come to it. Units are in funds, so a light tank taking
 * an expected 50% from one tank costs about 200 points on normal — enough
 * to prefer a tile one step back, not enough to refuse a good attack.
 */
const THREAT_WEIGHT: Record<AiDifficulty, number> = { easy: 0, normal: 0.06, hard: 0.1 };

function armyValue(units: Unit[]): number {
  return units.reduce((sum, u) => sum + (UNIT_DATA[u.type].cost * u.hp) / 100, 0);
}

/**
 * Caution for this turn. Pure threat-avoidance makes two careful armies
 * stare at each other forever, so it scales with relative strength (a
 * superior army presses), fades as the days pass (someone has to go), and
 * is dropped entirely when the AI defends against a survive objective —
 * there, the clock is the enemy and attacking is the whole job.
 */
function threatWeight(state: GameState, ai: PlayerId, enemies: Unit[], difficulty: AiDifficulty): number {
  const base = THREAT_WEIGHT[difficulty];
  if (base === 0) return 0;
  if (state.objective?.kind === 'survive' && ai === 'blue') return 0;
  const mine = armyValue(state.units.filter((u) => u.owner === ai));
  const theirs = armyValue(enemies);
  // Only ever less cautious, never more: a weaker army that hides loses the
  // income war anyway, so it may as well fight for ground.
  const ratio = theirs / Math.max(1, mine);
  const strength = Math.min(1, ratio * ratio);
  const tempo = Math.max(0.2, 1 - state.day / 25);
  return base * strength * tempo;
}

/** Expected damage, in funds, the enemy could deal to `unit` at (x, y) next turn. */
function threatAt(state: GameState, unit: Unit, x: number, y: number, enemies: Unit[], ignoreId?: number): number {
  const probe: Unit = { ...unit, x, y };
  const cost = UNIT_DATA[unit.type].cost;
  let total = 0;
  for (const e of enemies) {
    if (e.id === ignoreId) continue;
    const ed = UNIT_DATA[e.type];
    // Indirect units can't move and fire, so only their current range counts.
    const reach = isIndirect(e) ? ed.maxRange : ed.move + ed.maxRange;
    if (manhattan(e.x, e.y, x, y) > reach) continue;
    total += (computeDamage(state, e, probe) / 100) * cost;
  }
  return total;
}

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

  // Don't clog our own factories, ports, and airbases: a unit parked on one blocks building.
  const tile = tileAt(state, x, y);
  if (tile.owner === unit.owner && BUILD_SITES.includes(tile.terrain)) score -= tile.terrain === 'factory' ? 40 : 120;

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
    counter = computeDamage(state, { ...target, hp: target.hp - dmg }, { ...unit, x, y }, true);
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
    // Miners head for ore nobody else is sitting on.
    if (data.mods?.extractor) {
      const ore: { x: number; y: number }[] = [];
      this.state.tiles.forEach((t, i) => {
        const x = i % this.state.width;
        const y = Math.floor(i / this.state.width);
        const occ = unitAt(this.state, x, y);
        if (t.terrain === 'ore' && (!occ || occ.id === unit.id)) ore.push({ x, y });
      });
      return this.field(`ore-${unit.id}`, data.moveClass, ore.length > 0 ? ore : [{ x: unit.x, y: unit.y }]);
    }
    const sea = data.domain === 'sea';
    if (data.canCapture) {
      const targets = this.captureTargets(sea);
      if (targets.length > 0) return this.field(`cap-${data.moveClass}-${sea}`, data.moveClass, targets);
    }
    // Ships can't reach the enemy's tile, only water within firing range of it.
    if (sea) {
      const spots = this.strikePositions(unit);
      if (spots.length > 0) return this.field(`strike-${unit.type}`, data.moveClass, spots);
      return this.field('cap-sea-true', data.moveClass, this.captureTargets(true));
    }
    // Land units chase what they can walk to: not ships. With nothing in
    // view (fog), push toward enemy-held ground instead.
    const reachable = this.enemies.filter((e) => UNIT_DATA[e.type].domain !== 'sea');
    const goals = reachable.length > 0 ? reachable.map((e) => ({ x: e.x, y: e.y })) : this.captureTargets();
    return this.field(`enemy-${data.moveClass}`, data.moveClass, goals);
  }

  /** Properties this side could capture: at sea for ships, on land for everyone else. */
  private captureTargets(sea = false): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < this.state.height; y++) {
      for (let x = 0; x < this.state.width; x++) {
        const tile = tileAt(this.state, x, y);
        const td = TERRAIN_DATA[tile.terrain];
        if (td.capturable && tile.owner !== this.ai && (td.domain === 'sea') === sea) out.push({ x, y });
      }
    }
    return out;
  }

  /** Tiles this unit could stand on and fire at some enemy from. */
  private strikePositions(unit: Unit): { x: number; y: number }[] {
    const data = UNIT_DATA[unit.type];
    const mods = modsOf(unit.type);
    const out: { x: number; y: number }[] = [];
    for (const e of this.enemies) {
      if (DAMAGE[unit.type][e.type] === 0) continue;
      if (modsOf(e.type).submerged && !mods.antiSub) continue;
      for (let dy = -data.maxRange; dy <= data.maxRange; dy++) {
        for (let dx = -data.maxRange; dx <= data.maxRange; dx++) {
          const d = Math.abs(dx) + Math.abs(dy);
          const x = e.x + dx;
          const y = e.y + dy;
          if (d < data.minRange || d > data.maxRange || !inBounds(this.state, x, y)) continue;
          const td = TERRAIN_DATA[tileAt(this.state, x, y).terrain];
          if (td.moveCost[data.moveClass] === null || (td.shallow && mods.massiveHull)) continue;
          out.push({ x, y });
        }
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

function chooseBuildCommand(state: GameState, difficulty: AiDifficulty): Command | null {
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = tileAt(state, x, y);
      if (!BUILD_SITES.includes(tile.terrain) || tile.owner !== state.current) continue;
      if (unitAt(state, x, y)) continue;
      // An army with no land route anywhere needs ships, not more tanks.
      if (tile.terrain === 'factory' && strandedUnits(state).length >= 3) continue;
      const unitType =
        tile.terrain === 'factory'
          ? chooseBuildType(state, difficulty)
          : tile.terrain === 'port'
            ? chooseNavalType(state, difficulty)
            : chooseAirType(state, difficulty);
      if (!unitType) continue; // nothing worth building here
      return { kind: 'build', at: { x, y }, unitType };
    }
  }
  return null;
}

/**
 * Spare money after building goes into refinery upgrades, while the game is
 * young enough for them to pay back. Easy never bothers.
 */
function chooseUpgrade(state: GameState, difficulty: AiDifficulty): Command | null {
  if (difficulty === 'easy' || state.day > 25) return null;
  const reserve = difficulty === 'hard' ? 1000 : 3000;
  for (let i = 0; i < state.tiles.length; i++) {
    const x = i % state.width;
    const y = Math.floor(i / state.width);
    const up = nextUpgrade(state, x, y);
    if (up && state.funds[state.current] >= up.cost + reserve) return { kind: 'upgrade', at: { x, y } };
  }
  return null;
}

/**
 * Blitz: a ready Warmachine that is already on ore (or has no ore to go to)
 * builds on a free neighbouring tile, choosing the unit like a factory would.
 */
function chooseConstructorBuild(state: GameState, difficulty: AiDifficulty): Command | null {
  const ai = state.current;
  const anyOre = state.tiles.some((t) => t.terrain === 'ore');
  for (const b of state.units) {
    if (b.owner !== ai || b.acted || !modsOf(b.type).builder) continue;
    if (anyOre && tileAt(state, b.x, b.y).terrain !== 'ore') continue; // get to the ore first
    const type = chooseBuildType(state, difficulty);
    if (!type) return null;
    for (const [dx, dy] of DIRS) {
      const x = b.x + dx;
      const y = b.y + dy;
      if (!inBounds(state, x, y) || unitAt(state, x, y)) continue;
      if (tileAt(state, x, y).terrain === 'ore') continue; // leave ore for miners
      if (constructorCanBuild(state, type, x, y)) return { kind: 'build', at: { x, y }, unitType: type };
    }
  }
  return null;
}

/** Friendly units with no land route to any land property still to take. */
function strandedUnits(state: GameState): Unit[] {
  const ai = state.current;
  const targets: { x: number; y: number }[] = [];
  state.tiles.forEach((t, i) => {
    const td = TERRAIN_DATA[t.terrain];
    if (td.capturable && t.owner !== ai && td.domain !== 'sea') targets.push({ x: i % state.width, y: Math.floor(i / state.width) });
  });
  if (targets.length === 0) return [];
  const fields = new Map<MoveClass, number[]>();
  return state.units.filter((u) => {
    const data = UNIT_DATA[u.type];
    if (u.owner !== ai || data.domain !== 'ground') return false;
    if (!fields.has(data.moveClass)) fields.set(data.moveClass, distanceField(state, data.moveClass, targets));
    return !Number.isFinite(fields.get(data.moveClass)![u.y * state.width + u.x]);
  });
}

/** Whether this game's roster (a campaign Book's units) allows the type. */
function allowed(state: GameState, type: UnitType): boolean {
  return !state.roster || state.roster.includes(type);
}

function chooseAirType(state: GameState, difficulty: AiDifficulty = 'normal'): UnitType | null {
  const ai = state.current;
  const funds = state.funds[ai];
  const mine = state.units.filter((u) => u.owner === ai);
  const enemies = state.units.filter((u) => u.owner !== ai);
  const afford = (t: UnitType) => allowed(state, t) && funds >= UNIT_DATA[t].cost;
  const hasLift = mine.some((u) => u.type === 'skylift');
  const needLift = strandedUnits(state).some((u) => UNIT_DATA[u.type].moveClass === 'foot');
  if (needLift && !hasLift && afford('skylift')) return 'skylift';
  // Answer enemy aircraft with fighters; otherwise bomb.
  const enemyAir = enemies.filter((u) => UNIT_DATA[u.type].domain === 'air' && u.type !== 'skylift').length;
  const myFighters = mine.filter((u) => u.type === 'fighter').length;
  if (enemyAir > myFighters && afford('fighter')) return 'fighter';
  if (difficulty !== 'easy' && afford('bomber')) return 'bomber';
  return null;
}

function chooseNavalType(state: GameState, difficulty: AiDifficulty): UnitType | null {
  const ai = state.current;
  const funds = state.funds[ai];
  const mine = state.units.filter((u) => u.owner === ai);
  const enemies = state.units.filter((u) => u.owner !== ai);
  const count = (list: Unit[], type: UnitType) => list.filter((u) => u.type === type).length;
  const afford = (type: UnitType) => allowed(state, type) && funds >= UNIT_DATA[type].cost;

  // Stranded troops need a ferry before anything else.
  if (strandedUnits(state).length > 0 && count(mine, 'barge') === 0 && afford('barge')) return 'barge';

  // Unclaimed oil rigs are income only a Cutter can collect.
  const rigs = state.tiles.filter((t) => t.terrain === 'rig' && t.owner !== ai).length;
  if (rigs > 0 && count(mine, 'cutter') < Math.min(2, rigs) && afford('cutter')) return 'cutter';

  const enemyShips = enemies.filter((u) => UNIT_DATA[u.type].domain === 'sea').length;
  if (count(enemies, 'submarine') > count(mine, 'frigate') && afford('frigate')) return 'frigate';
  // No navy to fight and troops that can walk to the war: spend on land.
  // Stranded on an island, warships are the only way to hurt the enemy.
  if (enemyShips === 0 && strandedUnits(state).length === 0) return null;
  if (difficulty !== 'easy' && enemyShips >= 2 && afford('cruiser')) return 'cruiser';
  if (difficulty !== 'easy' && count(enemies, 'frigate') === 0 && afford('submarine')) return 'submarine';
  if (afford('destroyer')) return 'destroyer';
  if (afford('frigate')) return 'frigate';
  return null;
}

function chooseBuildType(state: GameState, difficulty: AiDifficulty): UnitType | null {
  const ai = state.current;
  const funds = state.funds[ai];
  const mine = state.units.filter((u) => u.owner === ai);
  const foot = mine.filter((u) => UNIT_DATA[u.type].canCapture && UNIT_DATA[u.type].domain === 'ground').length;
  const artillery = mine.filter((u) => u.type === 'artillery').length;
  const tanks = mine.filter((u) => u.type === 'lightTank' || u.type === 'heavyTank').length;

  const capturablesLeft = state.tiles.filter(
    (t) => TERRAIN_DATA[t.terrain].capturable && t.owner !== ai && TERRAIN_DATA[t.terrain].domain !== 'sea',
  ).length;

  // Keep enough foot soldiers to win the income war.
  if (foot < Math.min(4, capturablesLeft) && funds >= UNIT_DATA.infantry.cost) {
    return foot >= 2 && funds >= UNIT_DATA.bazooka.cost ? 'bazooka' : 'infantry';
  }

  // Enemy air power demands anti-air, at every difficulty.
  const enemies = state.units.filter((u) => u.owner !== ai);
  // Every armed aircraft counts (Book I only has helicopters).
  const enemyHelis = enemies.filter((u) => UNIT_DATA[u.type].domain === 'air' && u.type !== 'skylift').length;
  const myAntiAir = mine.filter((u) => u.type === 'antiAir').length;
  if (enemyHelis > myAntiAir && funds >= UNIT_DATA.antiAir.cost) return 'antiAir';
  const myHelis = mine.filter((u) => u.type === 'helicopter').length;

  // Rocket trucks answer ships and aircraft from behind the line.
  const enemyNavalOrAir = enemies.filter((u) => UNIT_DATA[u.type].domain !== 'ground').length;
  const myRockets = mine.filter((u) => u.type === 'rocketTruck').length;
  if (
    difficulty !== 'easy' &&
    allowed(state, 'rocketTruck') &&
    enemyNavalOrAir >= 2 &&
    myRockets < enemyNavalOrAir / 2 &&
    funds >= UNIT_DATA.rocketTruck.cost
  ) {
    return 'rocketTruck';
  }

  // Easy mode hoards cash and never fields top-end armor.
  if (difficulty === 'easy') {
    if (funds >= UNIT_DATA.lightTank.cost && Math.random() < 0.5) return 'lightTank';
    if (funds >= UNIT_DATA.recon.cost) return 'recon';
    if (funds >= UNIT_DATA.infantry.cost) return 'infantry';
    return null;
  }

  // Hard mode builds counters: against an armor-heavy enemy, favor the
  // units that trade up against tanks instead of generic value.
  if (difficulty === 'hard') {
    const enemies = state.units.filter((u) => u.owner !== ai);
    const armor = enemies.filter((u) => u.type === 'lightTank' || u.type === 'heavyTank').length;
    if (enemies.length > 0 && armor / enemies.length >= 0.4) {
      if (funds >= UNIT_DATA.heavyTank.cost) return 'heavyTank';
      if (funds >= UNIT_DATA.artillery.cost && artillery <= tanks + 1) return 'artillery';
      if (funds >= UNIT_DATA.bazooka.cost) return 'bazooka';
    }
  }

  if (funds >= UNIT_DATA.heavyTank.cost) return 'heavyTank';
  if (funds >= UNIT_DATA.helicopter.cost && myHelis < Math.max(1, Math.floor(tanks / 2))) {
    return 'helicopter';
  }
  if (funds >= UNIT_DATA.lightTank.cost) return 'lightTank';
  if (funds >= UNIT_DATA.artillery.cost && artillery <= tanks) return 'artillery';
  if (funds >= UNIT_DATA.recon.cost && state.day <= 4) return 'recon';
  if (funds >= UNIT_DATA.bazooka.cost) return 'bazooka';
  if (funds >= UNIT_DATA.infantry.cost) return 'infantry';
  return null;
}
