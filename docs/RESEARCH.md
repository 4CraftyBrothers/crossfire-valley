# Research digest: the Battalion series and Advance Wars

Compiled 2026-09-18 from the Kongregate wiki (Battalion: Series, Units of
Battalion Versions, Modifiers of Battalion Series, per-game pages), the
Spriters Resource inventory of *Battalion: Nemesis* assets, contemporary
reviews (Jay is Games, Gamezebo, Metamusing), and Wikipedia for the Wars
series. Where the wiki was silent (buildings/terrain pages are empty) the
sprite inventory and the modifiers table fill the gap. Numbers are the
originals' — ours use a different scale.

Legal note: everything here is *design reference*. Mechanics and structure
are not copyrightable; names, art, story, characters and text are, and
nothing from the originals is reproduced in the game.

## The series at a glance

| Game | Year | Type | What it added |
|---|---|---|---|
| Head-2-Head / Freedom | 2007 | multiplayer | Urbansquall's straight Advance Wars homage: different roster (AA Array, AT Array, Hover Tank, Interceptor, Nova Bomber, Carrier, Frigate…), Commandos capture, transports repair |
| **Nemesis** | Sep 2008 | single-player, 6 Boot Camp + 10 campaign + bonus + Spartan mission | New engine, art and roster ("Battalion: Modern"). Land + air + **sea** units, transports, cloaking, oil economy, three armour/weapon classes |
| Skirmish | May 2009 | 1-mission preview | Revamped graphics; **Warmachine** (mobile HQ that builds units and mines ore); Blockades; Jammer; Lancer and Spider tanks |
| Arena | Jul 2009 | multiplayer 1–4 players, co-op, map editor; servers off 2012 | **Normal vs Blitz** modes (buildings/income vs Warmachines/ore); unit rebalancing; paid units/colours |
| **Ghosts** | Nov 2009 | 6 tutorial + 10 campaign + bonus | Same engine as Arena; you play the *enemy* faction; mission 4 mixes Normal and Blitz; **three difficulty settings selectable per mission**; Vulture Drone |
| **Vengeance** | Jan 2010 | 8 tutorial + 10 campaign + bonus | Final chapter; third faction; no new units — hardest missions |

Datamining showed Ghosts, Arena and Vengeance are literally the same SWF
with an "episode" switch. Skirmish through Vengeance share one roster and
one balance table.

## Rosters

### Nemesis roster (the "Battalion: Modern" baseline)

Costs are the original's. Range = movement. Weapon min/max = attack range.

| Unit | Cost | Move | Rng | Type | Role / modifiers |
|---|---|---|---|---|---|
| Strike Commando | 75 | 3 | 1 | foot | cheap capturer; Tracking (attacks stealth units it bumps into) |
| Heavy Commando | 100 | 3 | 1 | foot | anti-tank infantry, captures |
| Flak Tank | 230 | 5 | 1 | tracked | anti-air, 2× vs light armour |
| Scorpion Tank | 270 | 6 | 1 | tracked | backbone; Blitz (+20% when attacking) |
| Mortar Truck | 300 | 5 | 2–3 | wheeled | cheap artillery; Counter Battery |
| Rocket Truck | 470 | 4 | 3–5 | wheeled | long range, hits air and subs; can't fire close |
| Annihilator Tank | 470 | 4 | 1 | tracked | heavy tank; Mammoth (−15% on counter) |
| Stealth Tank | 340 | 5 | 1 | tracked | Cloaking, 2× damage while cloaked; enemy-only in Nemesis |
| Turret | 100 | 0 | 2–5 | static | unbuildable defence, heals 5/turn |
| Albatross Transport | 20 | 6 | — | air | carries a Commando; needs Air Control |
| Raptor Fighter | 340 | 7 | 1 | air | the only air unit that hits air; good vs light ground |
| Condor Bomber | 650 | 4 | 1 | air | devastating vs ground, cannot counter (Blind Spot), Fire Bomb bonus vs units on structures |
| Leviathan Barge | 35 | 5 | — | sea | carries ground units shore-to-shore; needs Sea Control |
| Intrepid | 200 | 5 | 1 | sea | captures sea properties; weak |
| Hunter Support | 450 | 5 | 1 | sea | anti-sub, anti-air escort |
| Corvette Fighter | 500 | 4 | 1 | sea | "Scorpion of the sea"; Massive Hull (no shallows) |
| U-Boat | 475 | 4 | 1 | sea | Submerged (only Anti-Sub can hit it), cloaks |
| Battlecruiser | 800 | 4 | 3–6 | sea | longest range in the game; Massive Hull |
| Spartan | 250 | 5 | 1 | foot | Halo joke unit for a bonus mission |

### Added from Skirmish/Ghosts onward

| Unit | Cost | Move | Rng | Role / modifiers |
|---|---|---|---|---|
| Warmachine | 2500 | 3 | 2–3 | mobile HQ: builds units, extracts ore, Linchpin (lose all → defeat), unbuildable |
| Jammer Truck | 300 | 5 | — | Radar +1 sight; Jamming: no-fly zone that also uncloaks |
| Blockade | 40 | 0 | — | inert obstacle; irreparable, not selectable |
| Lancer Tank | 270 | 6 | 1 | Piercing: also damages the unit directly behind the target |
| Spider Tank | 250–270 | 4 | 1 | walks mountains; Stun (no counter-attack) |
| Vulture Drone | 550 | 5 | 1 | Scavenge: move and attack again after a kill |

### Damage model

Three weapon classes vs three armour classes: light weapons are weak vs
heavy armour, heavy weapons are weak vs light armour (×1.5 for light-on-
light), medium is neutral. Our 8×8 damage matrix encodes the same idea
explicitly, which is simpler to tune per pair; keep the matrix and extend
it as units are added.

### Modifiers worth stealing (the series' real flavour)

Blitz (+20% attacking), Mammoth (−15% counter), Courage Under Fire (+25%
counter), Counter Battery (ranged units counter ranged fire), Blind Spot
(no counter), Scavenge, Piercing, Stun, Cloaking / Cloak Damage, Tracking,
Submerged / Anti-Sub, Massive Hull, Maintenance (self-heal), Fire Bomb,
Overdrive (+2 range at full HP), Radar, Jamming, Linchpin, Transport,
Constructor, Extractor.

Terrain modifiers: Cover 10% / Camouflage 20% / Bunker 40% / Garrison 50%,
High Ground (−25% from ranged), Farsight (+1 ranged range), Canopy (ranged
can't fire from it), Shielded (can't be targeted by ranged), Hazard (20
damage per turn — volcanoes), Precipitous (foot only), Barbed (no foot),
Shallow vs deep water, Strait (+10% damage to ships), Tricky Waters.

### Buildings (from the sprite inventory + modifiers)

Command Center (HQ, Mission Critical), Factory (Construction), Air Control
(air units −5% each; required for Albatross), Ground Control, Sea Control
(required for Leviathan; sea construction), Oil Refinery / Advanced
Refinery (tiered income: $60 / $240 / $480 per round), Oil Rig (sea
income, captured by Intrepid), Flag (neutral marker). Warmachine mode adds
Ore Deposits (Extractable).

### Terrain (sprite inventory)

Grass, road, bridge, forest, mountain, deep and shallow water, shore/beach
(the only land–sea link; Leviathans load/unload there), cliffs (many edge
variants), canyon, sand, ore deposit, volcano. Reviewers singled out the
terrain art as the game's best-looking part.

## Structure, tutorial, difficulty, menus

- **Boot Camp** is a separate mode from the campaign in every single-player
  entry (6 lessons in Nemesis and Ghosts, 8 in Vengeance and Arena).
  Reviewers advised playing it because direct/indirect fire, capture and
  the armour classes are not obvious.
- Campaigns are **10 missions plus a bonus map**; Nemesis pacing: 1–3 pure
  combat with given units (tanks, then rockets, then damaged aircraft),
  4 first base to build from, 5 big base-vs-base map, 6 stealth hunt,
  **7 first coastal mission with naval production**, 8–9 start "parked in
  the water", 10 assault on a fortified enemy who holds most of the map.
- Ghosts/Vengeance: **three difficulties chosen per mission**, with badges
  for finishing all ten on hard; "huge difference between settings".
- Story: character portraits and dialogue between missions (Tucker, Mullen,
  Hayne, Durand, Pearl); "corny humour". Each game hands you a different
  faction (Northern Federation → Akadians → Dragoons).
- Menus were Flash-era list menus: Campaign / Boot Camp / Bonus; mission
  list with briefing text; no world map.
- Interface (Nemesis): select a unit → green movement tiles and red firing
  tiles at once; click an enemy in range to move-and-attack in one click;
  damage preview with advantage markers; **Ctrl selects the next unit**;
  moved units greyed; scrolling by edges/arrows. Criticised: long AI turns,
  no multiplayer, unit rear views hard to read.

## Advance Wars, for contrast

- Roster of ~18: Infantry, Mech, Recon, APC (transport, resupply), Tank,
  Md Tank, Neotank (AW2+), Artillery, Rockets, Anti-Air, Missiles, Lander,
  Cruiser, Sub, Battleship, Black Boat, Fighter, Bomber, B-Copter, T-Copter,
  Stealth. Days of Ruin added Bike, Flare, Anti-Tank, Seaplane and
  **unit veterancy** (I / II / Vet).
- Fuel and ammo, weather, fog of war, **Commanding Officers with charging
  powers** (the franchise's signature; Days of Ruin shrank them to zones).
- Campaign: branching mission map with CO choice; Field Training (tutorial)
  as a separate mode; War Room (score-attack maps); shop for COs/maps with
  earned coins; Design Room (map editor); pass-and-play and link play.
  Re-Boot Camp (2023) presents missions as nodes on an illustrated map.
- Scoring: Speed / Power / Technique → S/A/B rank, the ancestor of our stars.

## Menu conventions in popular mobile strategy games

- Level select as **nodes on a scrolling illustrated map** with a path,
  stars under cleared nodes, locks on future ones, the next node pulsing
  (Angry Birds/Candy Crush lineage; AW Re-Boot Camp; Warbits; Kingdom Rush).
- Briefing as a card over the map with portrait, objective, difficulty
  picker, Start.
- In battle: greyed acted units, a **next-unit** button, End Turn asks for
  confirmation only when units can still act (Wargroove); tap an enemy to
  see its threat range; long-press for details.
- Star ratings on results with retry/next, persistent per-mission best.

## What this means for Crossfire Valley

See MASTER_PLAN.md. Short version: our 8 units and 24 missions are a
faithful "Book I". The series' remaining content splits cleanly into three
more books — Nemesis' full land/air/sea roster with transports and oil,
then the Warmachine/ore "Blitz" era with the specialist tanks, then a
capstone that uses everything on hard. Boot Camp returns as a mode. The
campaign screen becomes a map.
