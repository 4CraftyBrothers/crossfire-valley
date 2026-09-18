# Crossfire Valley — master plan

Goal: roll the whole Battalion series' variety — and the best of Advance
Wars' structure — into one phone game, paced the way the series paced it,
without copying anything protectable. This document is the map; BACKLOG.md
is the ordered to-do list that implements it. RESEARCH.md has the sources.

Decisions already made (don't relitigate): Capacitor app, original IP and
art, mobile-first, single-player-first, $1.99 unlock with Act I / default
skirmish / local 2P free, "Done" as the stay order, threat-aware AI,
balance report before shipping missions.

## 1. Shape of the game

```
Main menu
├─ Play            → Campaign map (Books → Acts → mission nodes)
├─ Boot Camp       → 8 short lessons (separate from the campaign)
├─ Skirmish        → vs Computer / Local 2P / Online link, map picker
├─ Unit guide
├─ Map editor
└─ Settings
```

### Campaign map (replaces the mission list)

A scrolling illustrated map per **Book**, nodes joined by a path; each Act
is a region of that map. Node states: locked (grey), next (pulsing), done
(stars under it). Tapping a node opens a briefing card: portrait + a few
lines of dialogue, objective line, difficulty picker (Easy / Normal / Hard
— Ghosts/Vengeance style, hard gives a medal bonus), Start. Results overlay
shows stars and Retry / Next / Map. The list stays as an accessible
fallback (long-press the map title).

### Books

Each Book is a campaign the size of one Battalion game (10–12 missions +
bonus), introducing what that game introduced. Book I exists.

| Book | Modeled on | Introduces | Missions |
|---|---|---|---|
| **I — The Valley** (shipped) | Head-2-Head / early Nemesis | the 8 core units, capture, income, fog, objectives | 24 in 3 acts |
| **II — Skies and Seas** | Nemesis | Rocket Truck, Stealth Tank, Turrets, Air and Sea Control, Albatross air transport, **naval**: Intrepid, Hunter, Corvette, U-Boat, Battlecruiser, Leviathan barge; Condor Bomber; Oil Refinery income tiers; shores, shallows, bridges, cliffs | 12 + bonus |
| **III — Warmachine** | Skirmish / Ghosts / Arena | Warmachine + Ore Deposits (Blitz mode), Jammer, Spider Tank, Lancer Tank, Vulture Drone, Blockades, volcanoes, high ground, canyons; playing as the *other* side | 12 + bonus |
| **IV — Vengeance** | Vengeance | nothing new; a third faction, every unit, every mode, hard by default | 12 + bonus |

Pacing rule inside a Book, copied from Nemesis: 1–3 fight with given units
(no building), 4 first base you can build from, 5 big symmetrical map, 6
a gimmick hunt (stealth/fog), 7 the new domain arrives (sea in Book II,
Warmachine in Book III), 8–9 start from a bad position, 10–12 assault a
fortified enemy who holds most of the map; bonus map is a sandbox.

### Boot Camp

Separate mode, 8 lessons, each a tiny map with a scripted tutorial (our
fact-driven Tutorial class already supports this): 1 move & attack, 2
terrain & counter-fire, 3 capture & income, 4 build, 5 direct vs indirect,
6 air & anti-air, 7 fog & ambush, 8 transports & sea (once Book II ships).
Completing Boot Camp is its own medal. Campaign missions keep light
in-mission hints for their new mechanic.

### Story

A dozen portraits (original characters; two commanders per faction plus a
narrator/adjutant) and 3–6 lines of dialogue before and after each mission,
in the series' corny-but-warm register. Text lives in mission data; the
briefing card renders it. Book I gets a light retro-fit.

## 2. Engine additions, in dependency order

The engine is pure and tested (`src/engine`). Every addition below ships
with unit tests, a map validator update, AI support, guide entry, and a
balance-report run.

1. **Unit definition upgrade** — `UNIT_DATA` gains `domain` (ground/air/sea),
   `canCounter`, `blitz`/`mammoth`/`courage` multipliers, `noCounter`,
   `scavenge`, `piercing`, `stun`, `cloak`, `submerged`, `antiSub`,
   `transport: {capacity, domains}`, `heal`, `sight`. The damage matrix
   grows to N×N. Modifiers are data, resolved in `combat.ts`.
2. **Terrain upgrade** — `TERRAIN_DATA` gains `domain`, `shallow`,
   `shore`, `hazard`, `highGround`, `canopy`, `farsight`; new tiles:
   shore, shallows, bridge, cliff (impassable edge), canyon, volcano,
   ore, oil (3 tiers), oil rig, air/ground/sea control. Map format keeps
   one char per tile; the editor palette grows.
3. **Transports** — load/unload commands, cargo in `Unit`, Albatross
   (air, 1 foot unit) and Leviathan (sea, 2 ground units, shore tiles
   only). Air Control / Sea Control gate building them.
4. **Naval domain** — sea movement classes, sea capture (Intrepid → oil
   rigs, sea control), Submerged/Anti-Sub, Massive Hull vs shallows,
   Strait. AI: distance fields per domain, transport planning (simple:
   load nearest foot unit, sail to nearest enemy shore).
5. **Cloaking** — hidden-unless-adjacent like forests but by unit;
   Tracking on Commandos; Jamming aura reveals; Cloak Damage ×2.
6. **Oil / income tiers** — refinery tiles with per-tier income; Ground/
   Air/Sea Control cost discounts.
7. **Blitz mode** — Warmachine unit: Constructor (build adjacent),
   Extractor (mine ore on its tile), Linchpin (all lost = defeat);
   maps with ore deposits and no factories; mixed maps allowed.
8. **Specialists** — Spider (foot movement class for a vehicle + Stun),
   Lancer (Piercing), Vulture (Scavenge extra action), Jammer, Blockade,
   Turret (static, Maintenance).
9. **Per-mission difficulty selection** with medal weighting; Boot Camp
   mode; campaign map screen; story cards.

Rough effort (Opus, with the e2e + balance tooling in place): 1–2 ≈ 2
sessions; 3–4 ≈ 3 sessions and the riskiest (AI at sea); 5–6 ≈ 1; 7–8 ≈ 2;
9 ≈ 2; each Book's content ≈ 2 sessions plus a human balance pass.

## 3. UI decisions (from the research)

- Keep **Next (N)** and greyed acted units; add **End Turn confirmation
  when units can still act** (toggle in settings, on by default) — the
  most common new-player loss in this genre is ending the turn early.
- Selecting a unit shows movement (blue) and, for direct units, the tiles
  it could attack from its reach (red edge) — Nemesis' green/red. One-tap
  attack: tapping a reachable enemy from the selected state moves next to
  it and opens the attack forecast.
- Tap an *enemy* unit: show its move+fire threat range on the board.
- Damage forecast in the action bar ("−6 · counter −2").
- Campaign map replaces the list; briefing card gets portrait, dialogue,
  difficulty.
- Boot Camp entry on the main menu; first launch nudges to it.

## 4. Art direction (on hold until James approves a mockup)

Target register, from the actual sheets: smooth rendered-3D-style sprites
at ~45 px, high ¾ camera, whole units in team colour, specular highlights
and drop shadows; painted textured terrain with many edge variants
(shores, cliffs). Not pixel art, not flat, not chibi. Mockup 3 is the
closest so far; James wants it closer still — next attempt should work
from the reference sheets in `scratch/ref` (silhouettes and shading, never
copied pixels): rounder turrets, wrapped tracks, angled hull plates,
stronger rim light, terrain with shore/cliff edges. Rebuild order once
approved: terrain → buildings → 8 units → new units per Book.

## 5. Monetization

$1.99 one-time unlock (RevenueCat; App Store + Play). Free: Book I Act I,
Boot Camp, skirmish on Crossfire Valley, local 2P. Unlock: everything
else (Books, map pack, editor, future Books included). Ads: never.
Restore purchases in Settings. A developer toggle shows the locked state
without a store. Later option: Book IV as a second $0.99 IAP if the free
tier converts well — decide with data, not now.

## 6. Order of work

1. Backlog items B1–B6 (tutorial depth, end-turn confirm, threat range,
   forecast in bar, campaign map screen, Boot Camp) — polish Book I into a
   complete product.
2. Monetization scaffold (B7) so a release is possible.
3. Art overhaul (B8) — the one thing gating "looks like the game I loved".
4. Engine 1–2, then Book II content (naval last inside it).
5. Engine 5–8, Book III.
6. Book IV.
7. Release: TestFlight → App Store, Play internal → production.

Human input needed along the way: play-through balance notes per Book,
mockup approvals, store accounts.
