# Backlog

Ordered. Each item is written so a fresh session (any model) can pick it up
cold: read MASTER_PLAN.md §1–3 and the item, run `npm test` and
`E2E_BROWSER=msedge npm run e2e` (Windows) before and after, keep the
engine pure, update the unit guide when data changes, run the balance
report before shipping missions. Mark items `[x]` with the PR number when
merged. Conventions: branch per item, PR to `main`, merge when CI (test,
e2e, apk) is green.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[?]` needs James

## Book I polish (ship-quality single player)

- [x] B0 Tutorial for mission 2 (factories), Next-unit button, "Done" order — PR #15, `feat/done-and-unlock` carries the Done rename (unmerged; see B7).
- [ ] **B1 Guided hints for missions 3–6.** Add `tutorial` factories in `src/campaign/tutorial.ts` for Hold the Line (bazooka in forest, healing on buildings, "hold out" objective), Thunder Ridge (artillery can't move-and-fire; min range), Recon in Force (recon speed, capture race objective), Skyfall (anti-air vs helicopter, artillery can't hit air). 3–4 steps each, fact-driven, per-mission done flags already exist. Settings "Replay tutorial" text → "Missions 1–6".
- [ ] **B2 End Turn confirmation** when units can still act: a small confirm sheet ("3 units haven't moved — end turn anyway?"), settings toggle `confirmEndTurn` default on, never shown during the tutorial's explicit End Turn step. e2e: the whole-game test must click through it.
- [ ] **B3 Enemy threat range.** Tapping an enemy unit (idle mode) overlays the tiles it can move to (dim red) and attack (red edge) next turn — reuse `threatAt` logic in a pure `src/engine/threat.ts` (move reach + attack range, respecting indirect rules). Tap again or tap elsewhere to clear.
- [ ] **B4 Attack forecast in the action bar.** When in targeting mode and a target is tapped/hovered, show "−6 HP · counter −2 HP" in the bar/info strip before committing; on desktop also in the unit panel (exists). One-tap attack: from `selected`, tapping a reachable enemy moves to the best adjacent reachable tile (highest cover, then closest) and opens targeting with that target preselected.
- [ ] **B5 Campaign map screen.** Replace the list with a scrolling illustrated map per Book (`src/ui/campaignMap.ts`, canvas or SVG), nodes on a path, states locked/next/done with stars, act labels as regions, tap → briefing card (portrait placeholder, dialogue lines from `Mission.story?: {before: string[], after: string[]}`, objective, difficulty picker, Start). Keep the list reachable (long-press title) and keep e2e's `#campaign-list` assertions by rendering the list in a hidden panel or updating the tests. Difficulty picker: `Mission.difficulty` becomes the default; chosen difficulty stored with the save; medals ×1.0 easy / ×1.0 normal / +1 star cap on hard (design: hard can earn a 4th "hard" badge rather than more stars).
- [ ] **B6 Boot Camp mode.** Main-menu entry; `src/campaign/bootcamp.ts` with 7 lessons (8th after Book II): tiny 7×5–9×7 maps, each a Tutorial with 3–5 steps and a win condition; completion medal; first-launch nudge ("New here? Boot Camp is 10 minutes."). Lessons: move & attack; terrain & counter-fire; capture & income; build; direct vs indirect; air & anti-air; fog & ambush.
- [ ] **B7 Monetization scaffold.** `src/ui/entitlements.ts`: `isUnlocked()`, `setDevUnlock()`, RevenueCat via `@revenuecat/purchases-capacitor` (keys in `capacitor.config.ts`/env, empty = not configured → unlock screen shows "not available yet"). Gate: campaign nodes beyond Act I, skirmish maps other than Crossfire Valley, editor "Play/Share". Lock badges; `#screen-unlock` with price from the store, features list, Buy, Restore. Settings: Restore purchases; dev toggle only in `import.meta.env.DEV`. Local 2P stays free. Docs: STORE_LISTING gains the IAP product ids (`crossfire_unlock`). Needs James for store products; the code path must fail soft.
- [ ] **B8 Art overhaul** — blocked on mockup approval (`[?]`). Register per MASTER_PLAN §4. Work from `scratch/ref` sheets for silhouette/shading only. Order: terrain (incl. shore/cliff edge autotiling by neighbours), buildings, 8 units ×2 teams, facing left/right by mirroring, idle bob, then new units per Book. Keep `TILE`, `render()`, overlays; sprites cached in offscreen canvases keyed by (unit, team, facing). e2e + store screenshots regenerate after.
- [ ] B9 Hotseat polish for iPad pass-and-play: "pass the device" full-screen interstitial with the next player's colour and a Ready button (hides the board under fog); orientation-lock toggle in settings.
- [ ] B10 Sound pass: a short synth stinger per unit type on select/attack, victory/defeat jingles, optional ambient loop; volume slider.
- [ ] B11 Accessibility: colour-blind team patterns (stripes on blue units), larger text option, reduce-motion toggle.

## Book II — Skies and Seas (engine 1–6 + content)

- [ ] E1 Unit definition upgrade (domain, modifiers as data, N×N matrix) — tests for each modifier.
- [ ] E2 Terrain upgrade + new tiles + editor palette + validator (shore adjacency rules, bridges over shallows).
- [ ] E3 Transports (load/unload, cargo, Air/Sea Control gating) + AI use.
- [ ] E4 Naval domain (sea movement, Intrepid capture of rigs, Submerged/Anti-Sub, Massive Hull) + AI distance fields per domain.
- [ ] E5 Cloaking / Tracking / Jamming.
- [ ] E6 Oil refinery tiers + Control cost discounts.
- [ ] C2 Book II content: 12 missions + bonus, paced per MASTER_PLAN §1; new skirmish maps with coasts; guide entries; balance report; Boot Camp lesson 8.

## Book III — Warmachine

- [ ] E7 Blitz mode: Warmachine (Constructor, Extractor, Linchpin), ore deposits, mixed maps; AI mining/building.
- [ ] E8 Specialists: Spider (Stun, mountains), Lancer (Piercing), Vulture (Scavenge), Blockade, Turret; volcanoes (Hazard), high ground, canyons.
- [ ] C3 Book III content: 12 + bonus, playing the opposing faction; Blitz skirmish maps.

## Book IV — Vengeance

- [ ] C4 Book IV content: 12 + bonus, third faction palette, hard default, all modes; "complete every mission on hard" medal.

## Release

- [x] R0 Android APK on every merge (release `android-latest`) — PR #5/#8.
- [ ] R1 Play: keystore via `android-release.yml make_keystore`, secrets, `v0.4.0` tag, internal test track. Needs James (Play account).
- [ ] R2 iOS: Apple Developer enrollment → four secrets → `ios-release.yml` → TestFlight. Needs James.
- [ ] R3 Store listings from `docs/STORE_LISTING.md`; regenerate screenshots after art.
- [ ] R4 Privacy: keep `public/privacy.html` true (RevenueCat adds a purchase-processor note when B7 lands).

## Later / ideas parking lot

- Online async PvP with accounts (docs/PVP_ROADMAP.md) — only if players ask.
- Unit veterancy (Days of Ruin) as a Book III option.
- Daily skirmish with a seeded map; leaderboard of days-to-win.
- Cloud save via the platform (iCloud/Play Games) once accounts exist.
