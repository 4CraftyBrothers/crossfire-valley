/**
 * Authoritative move validation — the core of the server-as-referee model.
 *
 * A Supabase edge function (or any server process) receives a match's current
 * state and a proposed command, and calls `validateCommand` to decide whether
 * the move is legal. Because this imports the SAME `@crossfire/engine` the
 * client runs, the server and client can never disagree about the rules: the
 * server re-derives the resulting state from scratch, so a tampered client
 * can never smuggle in an illegal move. This is the whole anti-cheat story.
 *
 * The engine's `applyCommand` throws on any illegal command; we translate that
 * into a structured result the transport layer can act on (append the move and
 * broadcast, or reject and tell the client to resync).
 */
import { applyCommand } from '@crossfire/engine';
import type { Command, GameEvent, GameState } from '@crossfire/engine';

export type ValidationResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Validate a proposed command against the authoritative state. On success,
 * returns the server-computed next state and the events it produced — the
 * exact state to persist and broadcast. On failure, returns the engine's
 * rejection reason.
 */
export function validateCommand(state: GameState, command: Command): ValidationResult {
  try {
    const { state: next, events } = applyCommand(state, command);
    return { ok: true, state: next, events };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'illegal command' };
  }
}
