# Crossfire Valley

A turn-based strategy web game in the spirit of the flash-era classic
*Battalion: Nemesis* (and its ancestor, Advance Wars): red vs. blue armies
on a tile map, rock-paper-scissors units, capturable cities and factories,
and an income war that decides the battle.

**Current state: 6-mission campaign, vs-Computer, hotseat, and online
play-by-link PvP.** The **Campaign** button opens a six-mission arc —
from an infantry skirmish tutorial to a fog-of-war finale with uphill
odds; winning unlocks the next mission (progress saved locally). Or pick
the mode in the top bar — in "vs Computer" you play Red and the AI commands
Blue; in "Online — share link" you play a friend on any device,
correspondence-style: finish your turn, send the generated link over any
messenger, and your opponent watches your moves replay before taking theirs.
No accounts, no server — the whole match travels in the link.

## Play locally

```bash
npm install
npm run dev        # dev server
```

## Deploying

Pushes trigger `.github/workflows/deploy.yml`, which tests, builds, and
publishes `dist/` to GitHub Pages. One-time setup: in the repo, go to
**Settings → Pages** and set **Source: GitHub Actions**. Note that Pages on
a private repository requires a paid GitHub plan — make the repo public or
upgrade. Once enabled, the game lives at
`https://<owner>.github.io/<repo>/` and PvP links become shareable anywhere.

## How to play

- Click one of your units to see its movement range, click a tile to move,
  then pick an action: **Attack**, **Capture** (foot units on buildings),
  or **Wait**.
- Cities and factories pay **$1000/turn** to their owner. Factories build
  new units (click an empty one you own).
- Artillery outranges everything (range 2-3) but can't move and fire in the
  same turn, and can't defend itself up close.
- **Helicopters** ignore terrain entirely — they cross mountains and water
  and fly over enemy lines — but get no defensive cover and are shredded
  by **Anti-Air** (which also mows down infantry). Artillery cannot target
  aircraft at all.
- Under fog, ground units in **forests are invisible** even on lit tiles
  until an enemy moves adjacent — and marching through a hidden enemy
  springs an **ambush**: your unit stops short and loses its action.
- Units heal +2 HP/turn standing on friendly buildings. Terrain matters:
  forests and cities add defense, mountains are infantry-only, roads are fast.
- **Win** by capturing the enemy HQ or destroying every enemy unit.
- **Undo** rewinds any move before you end your turn (disabled under fog,
  where it would leak scouting information).
- Three AI difficulties in the mode picker: Easy misjudges and skips the
  big guns, Hard focus-fires wounded units and counter-builds your army.
- Synthesized retro sound effects (WebAudio, no assets) — mute with 🔊.
- **Fog of war** (optional, top-bar toggle, all modes): you only see within
  your units' sight — recon sees far, foot units see further from
  mountains, owned buildings watch their surroundings. You can't attack
  what your side can't see, but any allied unit can spot for artillery.

## Install as an app (PWA)

Once deployed over HTTPS, the game is installable: "Add to Home Screen"
on mobile (Share menu on iOS Safari) or the install icon in desktop
Chrome's address bar. A service worker caches the whole game on first
visit, so it launches instantly and **plays fully offline** — campaign,
vs-computer, hotseat, and the editor all work without a connection; only
opening a new PvP/map link needs one. Updates arrive automatically on
the next online visit. To invalidate the cache manually, bump `CACHE`
in `public/sw.js`.

## Commands

```bash
npm run dev        # dev server with HMR
npm test           # engine unit tests (vitest)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

## Architecture

The repo is an npm-workspaces monorepo so the client and a future
authoritative server can run byte-identical rules:

- `packages/engine/` — the shared `@crossfire/engine` package: a pure,
  deterministic rules engine. `applyCommand(state, command) -> { state,
  events }` never mutates its input and touches no DOM. The web app imports
  it, and so does the server, so the two can never disagree about the rules.
- `apps/web/` — the game itself (renderer, UI, AI, campaign, maps) and the
  PWA shell. This build is the product on every platform; the native
  iOS/Android apps (planned) are a Capacitor wrapper around it.
- `apps/server/` — a stub authoritative referee: `validateCommand` runs the
  shared engine to accept or reject a proposed move, the foundation for
  cheat-proof ranked play. See `docs/PVP_ROADMAP.md`.

Within `apps/web`:

- `src/ui/editor.ts` — the map editor: paint terrain (drag supported),
  set building owners, place units, and validate live. Maps travel as
  `#map=` links (same deflate+base64url scheme as PvP links) that load
  into both the game and the editor for remixing; the working map
  autosaves to localStorage. Custom maps work in every mode, including
  online PvP.
- `src/campaign/` — missions as pure data: each is a `MapDef` plus
  briefing text and a fog flag, so new missions are ~60 lines of data and
  zero engine changes. Asymmetric starting funds shape the difficulty.
- `src/ai/` — computer opponent. `nextAiCommand(state)` is pure and
  synchronous: it scores every legal (unit, destination, action) triple in
  rough funds value — damage traded, captures, advance-toward-objective via
  Dijkstra distance fields — plays the best one, then builds, then ends the
  turn. The UI calls it in a paced loop so the computer's turn is watchable.
- `src/ui/` — canvas renderer (`renderer.ts`) and input state machine +
  DOM HUD (`controller.ts`).
- `packages/engine/src/serialize.ts` — async PvP links. A turn is encoded as
  `{turn-start state, command log}`, deflate-compressed and base64url'd
  into the URL hash (~800 bytes). The recipient replays the commands
  through the same deterministic engine, which both animates the
  opponent's turn and reproduces the exact resulting state — determinism
  is the sync protocol, so the two devices can never disagree.
- `src/maps/` — map definitions as data (terrain grid string + property and
  unit placements).

## Roadmap

- [x] Movement, combat, capture, economy, hotseat play
- [x] AI opponent (skirmish vs. computer)
- [x] Async online PvP (play by link)
- [x] Fog of war
- [x] GitHub Pages deployment (workflow; enable Pages in repo settings)
- [x] Campaign (6 missions with unlock progression)
- [x] Air units (helicopter, anti-air), forest ambushes under fog
- [x] Installable PWA with full offline play
- [x] Map editor with shareable map links
- [x] Monorepo: shared `@crossfire/engine` package so client and server run
  identical rules (PvP roadmap P0)
- [ ] Accounts, cloud sync, server-refereed live PvP, ranked ladder, and
  native iOS/Android apps — see [`docs/PVP_ROADMAP.md`](docs/PVP_ROADMAP.md)
