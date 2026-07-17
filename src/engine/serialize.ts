import type { Command, GameState } from './types';

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
