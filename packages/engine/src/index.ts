/**
 * @crossfire/engine — the pure, deterministic rules engine.
 *
 * Zero I/O, zero DOM: `applyCommand(state, command) -> { state, events }`
 * never mutates its input, and a match serializes to a `{ startState,
 * commands }` log. Both the web client and the authoritative server import
 * THIS package so they run byte-identical rules — determinism is the sync
 * protocol, and the server is a cheat-proof referee by construction.
 *
 * This barrel is the package's public surface. Consumers import from
 * `@crossfire/engine`; internal modules still reference each other by
 * relative path.
 */
export * from './types';
export * from './data';
export * from './state';
export * from './movement';
export * from './vision';
export * from './combat';
export * from './game';
export * from './serialize';
