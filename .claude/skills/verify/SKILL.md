---
name: verify
description: Build, launch, and drive Crossfire Valley in a browser to verify changes at the real surface (phone, landscape, tablet sizes).
---

# Verifying Crossfire Valley

Browser game: TypeScript + Vite, canvas board, DOM HUD, wrapped by
Capacitor for Android/iOS. Verify by driving the page, not by importing
engine functions. Engine changes: `npm test` (vitest) is authoritative.

## Serve

```bash
npx vite --port 5173 --strictPort        # dev server (run in background)
npm run build && npx vite preview --port 4173 --strictPort   # production build
```

On this Windows machine, node/git may not be on the tool's PATH: prefix
with `export PATH="/c/Program Files/nodejs:/c/Program Files/Git/cmd:$PATH"`.

## Drive it

Two options:

1. The Claude desktop Browser pane (`navigate`, `javascript_tool`,
   `resize_window` with presets or custom sizes). Screenshots there can
   time out; prefer `javascript_tool` reads of DOM/state for assertions.
2. Headless Playwright installed in a scratch dir (never in this repo),
   which gives reliable screenshots at exact device resolutions.

Useful sizes: phone 375×812 / 430×932, landscape phone 812×375, tablet
1024×768 and 768×1024, desktop.

## App structure (ids)

Screens are `section.screen` elements toggled with `.active`:
`#screen-menu`, `#screen-campaign`, `#screen-skirmish`, `#screen-settings`,
`#screen-game`. Buttons: `#menu-continue` (hidden unless a save exists),
`#menu-campaign`, `#menu-skirmish`, `#menu-editor`, `#menu-settings`.

Campaign: `#campaign-list button` (locked ones disabled; `.act-title`
headers between acts) → briefing (`#briefing-title`, `#briefing-text`,
`#briefing-objective`) → `#briefing-start`.

Skirmish setup: `#opponent-group button[data-opponent=ai|hotseat|pvp]`,
`#difficulty-group button[data-difficulty]`, `#skirmish-fog`,
`#skirmish-map` (select of built-in maps + custom), `#skirmish-start`.

In game: `#hud-title`, `#day-label`, `#turn-chip`, `#funds-red`,
`#funds-blue`; board `canvas#board` inside `#board-wrap` (CSS-transformed
camera) inside `#viewport`; `#action-menu` (docked bar on phones, popup on
desktop) with Attack/Capture/Wait/Cancel buttons; `#tutorial` box with
`#tutorial-skip`; bottom bar `#menu-btn`, `#undo-btn`, `#end-turn-btn`.
Modals: `#pause-menu` (`#pause-resume`, `#pause-restart`, `#pause-sound`,
`#pause-quit`), `#results-menu` > `#results-content`, `#build-menu`,
`#share-menu`, `#editor`.

`window.__tcState` is a read-only handle to the live GameState (width,
height, units, day, current, winner, objective).

## Tile clicks

The canvas is camera-transformed; `getBoundingClientRect()` already
reflects it:

```js
const bb = await page.locator('#board').boundingBox();
const [w, h] = await page.evaluate(() => [window.__tcState.width, window.__tcState.height]);
await page.mouse.click(bb.x + (tx + 0.5) * bb.width / w, bb.y + (ty + 0.5) * bb.height / h);
```

Single-finger drag pans, wheel zooms, pinch zooms; a still tap is a board
tap. Right-click / Esc cancel.

## Timing

- Turn banner covers the board ~1.7 s after a turn change (pointer-events
  none, but it's in screenshots).
- The AI starts ~1.4 s after the banner and plays a command every 320 ms;
  wait for `#turn-chip` to say `red's turn` (or `wins`) rather than sleeping.
- Move animations ≤ 270 ms; damage popups ~1 s.

## Storage keys (clear for a fresh state)

`tactics-clash-campaign` (missions completed), `crossfire-valley-medals`,
`crossfire-valley-save` (autosave; makes Continue appear),
`crossfire-valley-tutorial` (`1` = done), `crossfire-valley-skirmish`
(prefs), `crossfire-valley-muted`, `tactics-clash-editor`.

Setting `tactics-clash-campaign` to `17` unlocks every mission.

## Balance

`npm test` prints a campaign balance report (`src/campaign/balance.test.ts`):
AI-vs-AI per mission plus a "turtle" probe for survive missions. The AI is
a weak attacker; read "blue wins" on symmetric standard maps accordingly.

## PWA / offline

The production build registers `public/sw.js` (dev builds and the native
app don't). Bump `CACHE` there to invalidate.
