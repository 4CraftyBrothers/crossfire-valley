---
name: verify
description: Build, launch, and drive Tactics Clash in a headless browser to verify changes at the real surface.
---

# Verifying Tactics Clash

Browser game: TypeScript + Vite, canvas board, DOM HUD. The surface is the
page — verify by clicking tiles in a real browser, not by importing engine
functions.

## Build & serve

```bash
npm run build                     # tsc --noEmit + vite build -> dist/
npx vite preview --port 4173 --strictPort   # serve the production build
```

## Drive it (Playwright)

Use the pre-installed Chromium — the `playwright` npm package version will
not match the installed browser, so always pass the executable path:

```js
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
```

Install `playwright` in a scratch dir, not in this repo.

Tile clicks: the canvas scales with CSS, so convert tile coords via the
bounding box (15x10 grid):

```js
const bb = await page.locator('#board').boundingBox();
await page.mouse.click(bb.x + (tx + 0.5) * bb.width / 15, bb.y + (ty + 0.5) * bb.height / 10);
```

## Flows worth driving

- Select a unit -> range overlay; click a reachable tile -> `#action-menu`
  appears (buttons: Attack/Capture/Wait/Cancel depending on context).
- Capture: infantry at (3,4) -> city (5,3) reaches it in one move on the
  default map; capture completes on the second turn.
- Combat: move red light tank (4,3) to (7,4), end turn, then blue tank
  (10,3) -> (8,4) gets an Attack option on it.
- Build: click an empty owned factory, e.g. red (2,2) -> `#build-menu`.
- `#end-turn-btn` ends the turn; the banner (`#banner`) blocks reading the
  board for ~1.7s after each turn change — wait it out before clicking.

## vs-Computer mode

`#mode-select` defaults to `ai` (human Red vs computer Blue); option
`hotseat` is two-human. Changing it restarts the game. During the AI's turn
clicks are inert and `#end-turn-btn` is disabled; the AI starts ~1.4s after
the turn banner and plays one command every 320ms. Wait for the turn chip
to contain `red` (or `wins`) rather than sleeping a fixed time — an AI turn
with builds can take several seconds, and the game can END during it.

## Online PvP (play by link)

Mode `pvp` in `#mode-select`. Ending your turn opens `#share-menu` with a
match link in `#share-link` (read its `inputValue`). Open that link in a
second page to play the other side: it replays the sender's turn (~1.4s +
320ms/command; wait for the turn chip to name the recipient's color), then
unlocks input. While waiting for the opponent, clicking the board reopens
the share modal. Bad links `alert()` and fall back to a fresh game —
install a `page.on('dialog')` handler before navigating to one.

## Campaign

`#campaign-btn` opens `#campaign-menu` (mission list; locked ones are
disabled buttons). Progress lives in localStorage key
`tactics-clash-campaign` (number of completed missions) — remove it for a
fresh state. Campaign games are always human-Red vs AI-Blue; mission maps
have different dimensions, so recompute tile click coords from
`window.__tcState` (a read-only handle to the live GameState, updated
every refresh — use it to find unit positions when scripting battles).

## Map editor

`#editor-btn` opens `#editor` (own canvas `#editor-board`, palette
`.palette-btn`s, owner radios `input[name="editor-owner"]`). Terrain
paints on mousedown/drag; units need a Red/Blue owner selected.
`#editor-status` shows live validation. Working map autosaves to
localStorage `tactics-clash-editor` — clear it for a fresh state. Share
links are `#map=<code>`; they load the map into the game AND seed the
editor. "Play this map" launches a skirmish with the current mode/fog.

## Gotchas

- The turn banner intercepts nothing (pointer-events: none) but visually
  covers the board in screenshots taken within ~1.7s of a turn change.
- Damage popups live ~1s; screenshot immediately after the attack click.
- HUD text (`#day-label`, `#turn-chip`, `#funds-red/blue`) is the quickest
  assertion of engine state from the page.
