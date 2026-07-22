import { TERRAIN_DATA, UNIT_DATA } from './data';
import { CHAR_TERRAIN } from './state';
import type { Command, GameState, MapDef, PlayerId } from './types';

/**
 * A shareable async-PvP turn: the state at the start of the sender's turn
 * plus every command they issued (ending with endTurn, unless the game
 * ended mid-turn). The recipient replays the commands through the engine,
 * which both animates the opponent's turn and reproduces the exact
 * resulting state — determinism is the sync protocol.
 */
export interface MatchPayload {
  v: 1;
  startState: GameState;
  commands: Command[];
}

const VERSION = 1;

export async function encodeMatch(startState: GameState, commands: Command[]): Promise<string> {
  const json = JSON.stringify({ v: VERSION, startState, commands });
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'undefined') {
    return 'r' + toBase64Url(raw); // uncompressed fallback
  }
  const deflated = await pipe(raw, new CompressionStream('deflate-raw'));
  return 'd' + toBase64Url(deflated);
}

export async function decodeMatch(code: string): Promise<MatchPayload> {
  const kind = code[0];
  const bytes = fromBase64Url(code.slice(1));
  let raw: Uint8Array;
  if (kind === 'd') {
    raw = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind === 'r') {
    raw = bytes;
  } else {
    throw new Error('Unknown match code format');
  }
  const payload = JSON.parse(new TextDecoder().decode(raw)) as MatchPayload;
  validate(payload);
  return payload;
}

function validate(p: MatchPayload): void {
  if (p.v !== VERSION) throw new Error(`Unsupported match version ${p.v}`);
  const s = p.startState;
  if (
    !s ||
    typeof s.width !== 'number' ||
    typeof s.height !== 'number' ||
    !Array.isArray(s.tiles) ||
    s.tiles.length !== s.width * s.height ||
    !Array.isArray(s.units) ||
    (s.current !== 'red' && s.current !== 'blue') ||
    !Array.isArray(p.commands)
  ) {
    throw new Error('Malformed match payload');
  }
  // Links from builds that predate fog of war default it off.
  if (typeof s.fog !== 'boolean') s.fog = false;
}

// ----- custom map links ----------------------------------------------------

export async function encodeMapDef(map: MapDef): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(map));
  if (typeof CompressionStream === 'undefined') return 'r' + toBase64Url(raw);
  return 'd' + toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')));
}

export async function decodeMapDef(code: string): Promise<MapDef> {
  const kind = code[0];
  const bytes = fromBase64Url(code.slice(1));
  const raw =
    kind === 'd'
      ? await pipe(bytes, new DecompressionStream('deflate-raw'))
      : kind === 'r'
        ? bytes
        : null;
  if (!raw) throw new Error('Unknown map code format');
  const map = JSON.parse(new TextDecoder().decode(raw)) as MapDef;
  const errors = validateMapDef(map);
  if (errors.length > 0) throw new Error(`Invalid map: ${errors[0]}`);
  return map;
}

/**
 * Full playability check for a MapDef — used by the editor UI and to guard
 * against hand-crafted #map= links. Returns human-readable problems.
 */
export function validateMapDef(map: MapDef): string[] {
  const errors: string[] = [];
  if (!map || !Array.isArray(map.grid) || map.grid.length === 0) return ['no terrain grid'];

  const height = map.grid.length;
  const width = map.grid[0]?.length ?? 0;
  if (width < 5 || width > 30 || height < 5 || height > 20) {
    errors.push(`map must be 5-30 wide and 5-20 tall (got ${width}x${height})`);
  }
  for (let y = 0; y < height; y++) {
    if (typeof map.grid[y] !== 'string' || map.grid[y].length !== width) {
      return [`row ${y + 1} is not ${width} tiles wide`];
    }
    for (const ch of map.grid[y]) {
      if (!CHAR_TERRAIN[ch]) return [`unknown terrain character '${ch}'`];
    }
  }

  const terrainAt = (x: number, y: number) => CHAR_TERRAIN[map.grid[y][x]];
  const inBounds = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height;

  if (!Array.isArray(map.properties)) return ['missing properties list'];
  const propKeys = new Set<string>();
  const hqs: Record<PlayerId, number> = { red: 0, blue: 0 };
  const factories: Record<PlayerId, number> = { red: 0, blue: 0 };
  for (const p of map.properties) {
    if (!inBounds(p.x, p.y)) return [`property out of bounds at ${p.x},${p.y}`];
    if (p.owner !== 'red' && p.owner !== 'blue') return [`bad property owner at ${p.x},${p.y}`];
    if (!TERRAIN_DATA[terrainAt(p.x, p.y)].capturable) {
      errors.push(`property at ${p.x},${p.y} is not on a building tile`);
    }
    const k = `${p.x},${p.y}`;
    if (propKeys.has(k)) errors.push(`duplicate property at ${k}`);
    propKeys.add(k);
    if (terrainAt(p.x, p.y) === 'hq') hqs[p.owner] += 1;
    if (terrainAt(p.x, p.y) === 'factory') factories[p.owner] += 1;
  }
  if (hqs.red === 0) errors.push('Red needs an HQ (paint one and set its owner)');
  if (hqs.blue === 0) errors.push('Blue needs an HQ');

  if (!Array.isArray(map.units) || map.units.length > 100) return ['bad units list'];
  const unitKeys = new Set<string>();
  const unitCount: Record<PlayerId, number> = { red: 0, blue: 0 };
  for (const u of map.units) {
    if (!UNIT_DATA[u.type]) return [`unknown unit type '${u.type}'`];
    if (u.owner !== 'red' && u.owner !== 'blue') return ['bad unit owner'];
    if (!inBounds(u.x, u.y)) return [`unit out of bounds at ${u.x},${u.y}`];
    if (TERRAIN_DATA[terrainAt(u.x, u.y)].moveCost[UNIT_DATA[u.type].moveClass] === null) {
      errors.push(`${UNIT_DATA[u.type].name} at ${u.x},${u.y} cannot stand on ${terrainAt(u.x, u.y)}`);
    }
    const k = `${u.x},${u.y}`;
    if (unitKeys.has(k)) errors.push(`two units share tile ${k}`);
    unitKeys.add(k);
    unitCount[u.owner] += 1;
  }
  for (const player of ['red', 'blue'] as PlayerId[]) {
    if (unitCount[player] === 0 && factories[player] === 0) {
      errors.push(`${player} needs at least one unit or factory`);
    }
  }

  const funds = map.startingFunds;
  const fundsOk =
    (typeof funds === 'number' && funds >= 0) ||
    (typeof funds === 'object' &&
      funds !== null &&
      typeof funds.red === 'number' &&
      funds.red >= 0 &&
      typeof funds.blue === 'number' &&
      funds.blue >= 0);
  if (!fundsOk) errors.push('bad starting funds');

  return errors;
}

async function pipe(bytes: Uint8Array, transform: ReadableWritablePair<Uint8Array, BufferSource>): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
