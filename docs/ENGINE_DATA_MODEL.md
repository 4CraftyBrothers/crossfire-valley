# Engine data model (E1/E2)

How units and terrain are described so that every Book's content is *data*
plus a small, tested rule in the engine — never a special case in the UI.
Read this before adding a unit, a tile, or a mechanic.

## Principles

1. **Data first.** `src/engine/data.ts` holds `UNIT_DATA`, `TERRAIN_DATA`
   and the `DAMAGE` matrix. A new unit is a row there, a column and row in
   the matrix, a guide note, a sprite. A new tile is a row plus a character
   in `CHAR_TERRAIN`.
2. **Modifiers are flags on data, resolved in one place each.** Combat
   flags resolve in `combat.ts`; movement flags in `movement.ts`; turn
   flags in `game.ts` `startTurn`. No flag is read from the UI.
3. **The engine stays pure and deterministic.** `applyCommand(state, cmd)`
   never mutates its input and never reads globals besides data tables.
4. **Defaults are the current game.** Every new field is optional or has a
   default that reproduces Book I behaviour exactly; the 59+ tests pin it.
5. **Validate at the boundary.** `validateMapDef` must reject anything the
   engine would throw on (units on impassable tiles, ships on land, etc.).

## Units

```ts
interface UnitData {
  name; cost; move; moveClass; minRange; maxRange; canCapture; vision;
  domain: 'ground' | 'air' | 'sea';          // what attacks/carries it
  mods?: UnitMods;                            // all optional, all off by default
}
interface UnitMods {
  blitz?: number;        // + fraction damage when this unit initiates   (Scorpion: 0.2)
  mammoth?: number;      // − fraction damage on its counter-attacks     (Annihilator: 0.15)
  courage?: number;      // + fraction damage on its counter-attacks
  noCounter?: boolean;   // Blind Spot: never counter-attacks            (Condor)
  counterBattery?: boolean; // indirect unit returns fire on indirect attackers in its range
  stun?: boolean;        // targets never counter this unit's attacks    (Spider)
  scavenge?: boolean;    // may act again after a kill, once per turn    (Vulture)
  piercing?: number;     // fraction of damage also dealt to the unit directly behind the target (Lancer)
  submerged?: boolean;   // only antiSub attackers can target it         (U-Boat)
  antiSub?: boolean;     // may target submerged units                   (Hunter, Rocket Truck, Condor)
  massiveHull?: boolean; // cannot enter shallows                        (Corvette, Battlecruiser)
  heal?: number;         // HP regained at the start of its owner's turn (Turret)
  transport?: { capacity: number; carries: MoveClass[] };  // E3
  cloak?: boolean;       // E5: hidden unless adjacent; ×2 damage from cloak
  tracking?: boolean;    // E5: attacks a cloaked unit it bumps into
  jamming?: number;      // E5: radius that reveals cloaked units and bars air
  linchpin?: boolean;    // E7: losing all linchpins is defeat
  constructor?: boolean; // E7: builds units on adjacent tiles
  extractor?: boolean;   // E7: mines ore on its tile
  unbuildable?: boolean; // never offered in a factory
}
```

`Unit` gains `scavenged?: boolean` (reset each turn) now, and `cargo`,
`cloaked` in E3/E5.

### Combat resolution (`combat.ts`)

`computeDamage(state, attacker, defender, counter = false)`:

```
base   = DAMAGE[attacker][defender]                 // 0 = no weapon
scale  = attacker.hp / 100
cover  = 1 − stars(defender tile) × visualHp(defender) / 100   // air ignores cover
mult   = 1 + (counter ? courage − mammoth : blitz)   // attacker's own mods
highGround: if defender tile.highGround and attacker is indirect → mult −= 0.25
dmg    = round(base × scale × cover × mult), never below 0
```

`attackableTargets` additionally requires `attacker.antiSub` for
`submerged` targets, and forbids firing *from* a `canopy` tile for indirect
units.

`canCounter(attacker, defender)`:
- defender alive, attacker not `stun`, defender not `noCounter`;
- direct vs direct at distance 1 (Book I rule), **or** defender
  `counterBattery` and both indirect and attacker within the defender's
  range.

`applyAttack`: damage → counter → `piercing` splash on the tile beyond the
target (enemy units only) → rout check → `scavenge`: if the target died and
the attacker has `scavenge` and hasn't scavenged this turn, `applyAttack`
returns true and `applyMove` leaves the unit un-acted (`scavenged = true`).

### Turn start (`game.ts` `startTurn`)

income → un-act units, clear `scavenged` → building repair → `heal` mods →
terrain `hazard` damage (units on hazard tiles lose that many HP; a unit
reduced to 0 is removed and the rout check runs) → survive objective.

## Terrain

```ts
interface TerrainData {
  name; defenseStars; capturable;
  domain: 'land' | 'sea' | 'shore';           // shore is land that barges can touch
  moveCost: Record<MoveClass, number | null>; // MoveClass now includes 'sea'
  income?: number;      // per-turn income override (refinery 2000; default 1000)
  shallow?: boolean;    // massiveHull ships cannot enter
  hazard?: number;      // HP lost by non-air units that start a turn here
  highGround?: boolean; // −25% damage from indirect fire
  canopy?: boolean;     // indirect units cannot fire from here
  builds?: ('ground' | 'air' | 'sea')[];      // what a construction tile can build (factory: ground)
}
```

Tiles and characters (`CHAR_TERRAIN`):

| char | terrain | notes |
|---|---|---|
| `.` | plain | |
| `r` | road | |
| `f` | forest | cover 2, hides under fog |
| `m` | mountain | foot + air only, foot sees farther |
| `w` | water | sea + air |
| `c` `F` `H` | city / factory / hq | capturable; factory builds ground |
| `s` | **shore** | land, cover 0; the only place a barge loads/unloads (E3) |
| `x` | **shallows** | sea, cover 0; massive hulls can't enter; bridges cross it |
| `b` | **bridge** | land classes 1, sea blocked; cover 0 |
| `v` | **volcano** | impassable to everything, including air |
| `R` | **refinery** | capturable, income 2000, cover 2 |

Air Control / Sea Control / Ground Control / Oil Rig / Ore arrive with E3,
E6, E7 respectively and follow the same pattern.

## Adding content — the recipe

1. `data.ts`: add the unit (or tile) row; for units add its `DAMAGE` row
   **and** column (every existing unit needs a number against it).
2. `types.ts`: extend the `UnitType` / `Terrain` union; for tiles add the
   character in `state.ts` `CHAR_TERRAIN`.
3. `guide.ts`: a one-line note; the stats and matchups derive automatically.
4. `renderer.ts`: a sprite / tile case. (Until the art overhaul, a clear
   placeholder is acceptable.)
5. `editor.ts`: the palette lists terrain from a fixed order — add it.
6. Tests: a matchup or movement assertion in `engine.test.ts` /
   `terrain.test.ts`; `mapdef.test.ts` covers validation automatically.
7. Run the balance report if the unit appears in any mission.

## What E3–E8 add on top

E3 transports (`cargo`, load/unload commands, Control buildings gate the
transport types); E4 sea capture by Intrepid-class units and oil rigs; E5
cloaking (`cloaked` state, reveal rules in `vision.ts`); E6 Control
discounts; E7 Warmachine (Constructor/Extractor/Linchpin, ore tiles, Blitz
maps with no factories); E8 the remaining specialists. Each is a flag here
plus one rule in the file named above.

## E3 — transports (implemented)

- Units: `skylift` (air, move 6, carries 1 `foot`, built at `airbase`) and
  `barge` (sea, move 5, carries 2 of `foot`/`tires`/`treads`, built at
  `port`). Both are unarmed (all-zero DAMAGE rows). `UnitData.builtAt`
  lists the buildings that make a type (default `['factory']`);
  `BUILD_SITES` is every producing building.
- Tiles: `A` airbase and `P` port (capturable, pay income). Shore and
  port tiles cost 1 for `sea`, so ships beach there and ground units can
  walk on — that's the only place the two domains meet.
- `Unit.cargo?: Unit[]` holds passengers off the board. They have no
  vision, can't be targeted, and die with their transport.
- Commands: `{ type: 'load' }` moves a unit onto a friendly transport's
  tile (`canCarry`, `boardableTransports` in movement.ts);
  `{ type: 'unload', drops }` moves the transport, then sets passengers
  on adjacent tiles they can stand on (`dropTiles` in game.ts). Dropped
  units have acted. A hidden enemy on a drop tile blocks it like an
  ambush.
- AI: a unit with no land route to any goal boards a reachable
  transport; a loaded transport scores drops by the passengers' own goal
  fields; an empty one fetches stranded friends or stays out of danger.

## E4 — naval domain (implemented)

| Ship | Cost | Move | Range | Notes |
|---|---|---|---|---|
| Cutter | 5000 | 6 | 1 | captures oil rigs; light guns |
| Frigate | 9000 | 6 | 1 | `antiSub`; strong vs aircraft and subs |
| Destroyer | 14000 | 5 | 1 | `massiveHull`; the main warship |
| Submarine | 16000 | 5 | 1 | `submerged`; only hits ships |
| Cruiser | 20000 | 4 | 3–5 | `massiveHull`; indirect, can't hit air |

- Tile `O` oil rig: sea, capturable, $1500 a turn, cover 1.
- Capture domains: ships capture only sea properties; everyone else only
  land (and shore) properties (`captureDomainOk` in game.ts).
- AI: ships aim at water tiles within firing range of targetable enemies
  (`strikePositions`), Cutters at rigs. Ports build a Barge for stranded
  troops, Cutters for unclaimed rigs, Frigates against subs, then
  Cruiser / Submarine / Destroyer against an enemy navy. Airbases build a
  Skylift only for stranded foot soldiers.

## E5 — cloaking, tracking, jamming (implemented)

- `mods.cloak` (Stealth Tank, Submarine): `canSeeUnit` hides the unit from
  the other side — fog or not — unless one of their units is adjacent or
  within a `mods.jamming` radius (`detectedBy` in vision.ts). Every
  visibility check (movement blocking, targeting, drops, AI, rendering)
  goes through `canSeeUnit`, so cloaks just work everywhere.
- Moving into an unseen cloaked unit is an ambush. Units with
  `mods.tracking` (Infantry, Bazooka) then attack it automatically.
- A cloaked unit the enemy hasn't found when it starts its move strikes
  for `CLOAK_STRIKE` (×2); `forecastAttack` includes it. Firing sets
  `Unit.revealed` until its owner's next turn, so the other side can hit
  back; the Stealth Tank's own guns are modest so a strike from hiding
  hurts without one-shotting healthy units.
- `GameState.roster` (from `createGame(map, { roster })`) limits what can
  be built. Book I missions and Boot Camp pass `BOOK_ONE_ROSTER`.
- UI: undo is off while an enemy could be cloaked (it would leak
  positions); cloaked units draw see-through.

## E6 — oil tiers and control discounts (implemented)

- `TerrainData.upgrades` lists paid tiers; the refinery has two
  ($6000 → $3500 a turn, $9000 → $5000 a turn). `Tile.level` records the
  tier (absent = 1) and survives capture. Command `{ kind: 'upgrade', at }`;
  helpers `nextUpgrade` (game.ts) and `tileIncome` (state.ts).
- `unitCost(state, player, type)`: air units cost 5% less per owned
  Airbase and ships 5% less per owned Port, capped at 20%. Used by
  building and the build menu (which shows the struck-through base price).
- AI: after building, normal/hard spend spare funds (keeping a reserve)
  on refinery upgrades before day 25.

## E7 — Blitz mode (implemented)

- `warmachine`: move 3 treads, range 1, very tough, `unbuildable`, with
  `mods.builder` (builds a unit on an empty neighbouring tile — anything
  in the roster that can stand there; the build is its action),
  `mods.extractor: 1500` (income at turn start while on an `o` ore
  deposit), `mods.linchpin` (a side that started with one loses when
  none remain: `GameState.linchpin`, checked in `checkRout`), and
  `heal: 5`.
- `canBuildAt` is true next to a ready builder; `constructorFor` and
  `constructorCanBuild` (game.ts) drive the engine, the build menu and
  the AI.
- AI: a Warmachine heads for free ore (its own goal field), builds once
  it's on ore (before other units move, since building is its turn), and
  weighs threats to it three times as heavily.
