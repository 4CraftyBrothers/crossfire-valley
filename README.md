# Tactics Clash

A turn-based strategy web game in the spirit of the flash-era classic
*Battalion: Nemesis* (and its ancestor, Advance Wars): red vs. blue armies
on a tile map, rock-paper-scissors units, capturable cities and factories,
and an income war that decides the battle.

**Current state: vs-Computer and hotseat two-player.** Pick the mode in the
top bar — in "vs Computer" you play Red and the AI commands Blue.

## Play locally

```bash
npm install
npm run dev        # dev server
```

## How to play

- Click one of your units to see its movement range, click a tile to move,
  then pick an action: **Attack**, **Capture** (foot units on buildings),
  or **Wait**.
- Cities and factories pay **$1000/turn** to their owner. Factories build
  new units (click an empty one you own).
- Artillery outranges everything (range 2-3) but can't move and fire in the
  same turn, and can't defend itself up close.
- Units heal +2 HP/turn standing on friendly buildings. Terrain matters:
  forests and cities add defense, mountains are infantry-only, roads are fast.
- **Win** by capturing the enemy HQ or destroying every enemy unit.

## Commands

```bash
npm run dev        # dev server with HMR
npm test           # engine unit tests (vitest)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

## Architecture

- `src/engine/` — pure, deterministic rules engine. `applyCommand(state,
  command) -> { state, events }` never mutates its input; the UI is the
  only thing that talks to the DOM. This split keeps the engine unit-testable
  and leaves the door open for AI opponents, replays, undo, and server-side
  move validation (async multiplayer) without a rewrite.
- `src/ai/` — computer opponent. `nextAiCommand(state)` is pure and
  synchronous: it scores every legal (unit, destination, action) triple in
  rough funds value — damage traded, captures, advance-toward-objective via
  Dijkstra distance fields — plays the best one, then builds, then ends the
  turn. The UI calls it in a paced loop so the computer's turn is watchable.
- `src/ui/` — canvas renderer (`renderer.ts`) and input state machine +
  DOM HUD (`controller.ts`).
- `src/maps/` — map definitions as data (terrain grid string + property and
  unit placements).

## Roadmap

- [x] Movement, combat, capture, economy, hotseat play
- [x] AI opponent (skirmish vs. computer)
- [ ] Campaign missions
- [ ] Fog of war
- [ ] Async online multiplayer, map editor
