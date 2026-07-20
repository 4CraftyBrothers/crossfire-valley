# Crossfire Valley — Competitive PvP + Native App Roadmap

Status: **planning → building**. This document plans the shift from a fully
serverless game to an online competitive platform with accounts, matchmaking,
live timed play, ranked MMR, and native iOS/Android apps — all sharing one
codebase and one account. The decisions below are **locked** (§2); the phase
work (§5) is what we build against.

---

## 0. North-star principle — total cross-platform parity

**Identical experience at every entry point.** Web, installed PWA, iOS, and
Android must look, feel, and play the same, because they are literally the
same web build: the native apps are a **Capacitor** shell wrapping that build,
not a reimplementation. One account works everywhere; a player starts a match
on the web at lunch and finishes it on their phone on the train.

Concretely, this means:

- **One codebase, one UI.** No platform-specific screens or layouts. The web
  build is the product; native is a wrapper around it.
- **One account, server-owned state.** Progress, cosmetics, rating, and
  in-progress games live server-side and sync to any device the player signs
  into. The device is a view, not the source of truth.
- **Native features are additive and degrade gracefully.** Push
  notifications, haptics, and in-app purchase use native APIs when present and
  fall back cleanly on the web (web push where supported, no-op haptics,
  Stripe instead of store billing). Turning a native feature off never breaks
  a screen — the experience stays substantively identical everywhere.

Every decision in this roadmap is measured against this principle: if a
feature would make one platform meaningfully different from another, we either
find the parity-preserving version or we don't ship it.

---

## 1. The central reality

Today the game is **100% serverless**: a static site (GitHub Pages / PWA)
where PvP travels inside `#m=` URLs. There is no backend, no accounts, no
database, no server clock. Every feature in this overhaul requires standing
up a backend, and live timed play requires real-time infrastructure on top.
This is the largest architectural change in the project's history.

**Our ace: the deterministic engine.** From day one the rules live in a
pure `applyCommand(state, command) -> { state, events }` with zero I/O
(`src/engine/`), and turns already serialize as a `{startState, commands}`
log (`src/engine/serialize.ts`). That means:

- The **server runs the exact same engine** to validate every move — ranked
  play is cheat-proof by construction (server is the referee, client is a
  view).
- Client and server can never disagree (determinism is the sync protocol —
  already proven by the play-by-link replay feature).
- The network only ever carries **commands** (tiny), never board state.

We do **not** rewrite the engine. We wrap it in a shared package, a server,
and a transport — and wrap the whole web build in Capacitor for the stores.

---

## 2. Locked decisions

These are settled. The phases in §5 are built against them.

| # | Decision | Choice |
|---|----------|--------|
| D1 | **Backend** | **Supabase** — Postgres + auth + realtime + edge functions. Real SQL for MMR/leaderboards, generous free tier, self-hostable escape hatch, fits the validate-with-engine model. |
| D2 | **Auth** | **Anonymous-first**, upgrade to **Sign in with Apple + Google**. The *same account* works across web, iOS, and Android — sign in anywhere, get your games and cosmetics. |
| D3 | **Server authority** | The server runs the **same deterministic engine** to validate **every** move. Client proposes commands; server is the referee and owns the clock, RNG seed, and resulting state. |
| D4 | **Native wrapper** | **Capacitor**, wrapping the same web build. **Both stores** (App Store + Google Play), one codebase. No separate native UI. |
| D5 | **First live mode** | **Correspondence** (5-min/turn + 24h/turn) ships before blitz (3s/turn). Lowest latency risk; proves accounts + matchmaking + server authority before chasing millisecond timing. |
| D6 | **Store submission timing** | Submit to the App Store and Play Store **only after a fully working product incl. PvP + ranked** (post-Phase 4). Never a thin wrapper — see the minimum-functionality forcing-function in §3. |
| D7 | **Monetization** | **Deferred.** Grow the player base and prove retention **first**, then add cosmetics (skins/themes **as code**, strictly **no pay-to-win**). Three payment rails — **Apple IAP, Google Play Billing, Stripe (web)** — all granting **one** server-side entitlement. |
| D8 | **Push notifications** | **Shipped by release.** Built alongside correspondence (Phase 2), guaranteed present at store launch — a correspondence game is unplayable if you never learn it's your turn. |

Change any of these and the phases adjust, but the *ordering* stays the same.

---

## 3. The three store forcing-functions

Shipping to Apple and Google reshapes three decisions. They are the "why"
behind D6, D7, and the parity work:

1. **Stores take 15–30% and require *their* IAP for in-app digital goods.**
   Cosmetics bought inside the iOS/Android app must go through Apple IAP /
   Google Play Billing; the web keeps **Stripe**. All three grant the **same**
   server-side entitlement, so what you own is identical everywhere (parity).

2. **Sign in with Apple becomes mandatory once Google login exists.** Apple
   requires an equivalent Apple sign-in option in any app offering a third-party
   social login. So D2's "Apple + Google" is not optional polish — Google login
   forces Apple login for the iOS build.

3. **Apple's minimum-functionality bar.** Apple rejects thin web wrappers. The
   app must be a genuine, full-featured product on its own. This is precisely
   why we submit **post-ranked** (D6): by then the app is a complete competitive
   game — accounts, live matches, matchmaking, ranked ladder — not a bookmark.

---

## 4. Guiding principles

1. **Parity first (§0).** Every platform is the same web build; divergence is a
   bug, not a feature.
2. **Never break what works.** Serverless play-by-link and local modes
   (campaign, vs-AI, hotseat) keep working forever, offline. Online is
   additive, gated behind login. Offline is the graceful-degradation floor,
   not a second-class mode.
3. **Server-authoritative for anything ranked.** The client proposes commands;
   the server validates with the engine and owns the clock, seed, and resulting
   state. No trust in the client.
4. **No pay-to-win, ever.** Every purchasable thing is cosmetic or
   convenience-that-doesn't-touch-balance. Non-negotiable for a ranked
   strategy game's reputation.
5. **Ship a spine, then widen.** Get one real ranked correspondence match
   working end-to-end (server-refereed, resumable on any device) before adding
   blitz, seasons, or a store.

---

## 5. Architecture at a glance

```
   ┌──────────────────────────────────────────────────────────────┐
   │  ONE WEB BUILD  (renderer · UI · @crossfire/engine · online)   │
   └──────────────────────────────────────────────────────────────┘
        │ served as-is        │ wrapped by Capacitor
        ▼                     ▼
   Web / PWA            iOS app  ·  Android app
   (Stripe)             (Apple IAP)  (Play Billing)   ← native push/haptics/IAP,
        │                     │        additive, graceful fallback on web
        └─────────┬───────────┘
                  │  websockets (commands + clock) · https (auth, matchmaking, store)
   ┌──────────────▼───────────────────────────────────────────────┐
   │  Supabase (authoritative)                                      │
   │   - runs @crossfire/engine to validate every move             │
   │   - owns turn clocks, timeouts, RNG seed, results             │
   │   - Postgres: profiles, matches, moves, ratings, seasons,     │
   │               entitlements, transactions                      │
   │   - Auth (anon + Apple + Google) · Matchmaking · Push · Store  │
   └───────────────────────────────────────────────────────────────┘
```

**Key refactor enabling all of this:** extract the engine into a shared
package (`packages/engine`) imported by **both** the client and the server, so
both run byte-identical rules. The engine has no DOM/browser deps already, so
this is mechanical — it is **Phase 0**.

---

## 6. Sequencing spine

The spine is ordered by risk: foundation and the server-refereed match come
first; the native wrapper is built in parallel and hardened by the ranked
milestone; the store submission and monetization come last.

### P0 — Shared engine package
Extract `src/engine` into `packages/engine` (pure, framework-free) imported by
both a web app and a server build, so **client and server run identical rules**.
Existing engine tests move with it; a stub server build validates a real
command through the shared package.
- **Exit:** the server can validate a real command with the shared engine, and
  the web app still builds/tests/deploys unchanged for players.

### P1 — Accounts + cross-platform cloud sync
Anonymous-first login; upgrade to Apple/Google. Existing **local** progress
(campaign unlocks, cosmetic loadout, settings) syncs to the account and back
down to any device, with an **offline fallback + merge** so guests and
offline players never lose data. This is where parity becomes real: sign in on
a second device and everything is there.
- **Exit:** a player has one durable identity and their progress across every
  device, with offline still working.

### P2 — Server-refereed correspondence matches (+ push plumbing)
The spine. `matches` + append-only `moves` (command log per match). Realtime
channel per match; client sends a command, server validates via the engine,
appends it, broadcasts, updates whose-turn. Turn clock server-timestamped;
**5-min/turn** and **24h/turn** presets. Reconnect = re-subscribe and replay
the log. **Push notification plumbing is built here** (D8) — "it's your turn"
is the first notification.
- **Exit:** two logged-in players complete a timed correspondence game the
  server refereed, **resumable on any device**, survivable across disconnects,
  with a turn notification.

### P3 — Matchmaking + unranked live queue
"Find match" queue with presence; pair by simple criteria first. Lobby /
challenge-a-friend by handle or link.
- **Exit:** press a button, get paired with a stranger, play — unranked.

### P4 — Ranked + seasons + leaderboards  ⟵ "fully working product" milestone
**Glicko-2** rating (rating + deviation + volatility; better than Elo for
irregular play), computed server-side after each ranked result. `ratings`
(per season, per mode), `seasons`, leaderboard views. Matchmaking pairs by
rating + deviation; placement matches; soft resets per season.
- **Exit:** a ranked ladder with visible rank, MMR-based pairing, and a live
  season. **This is the bar for store submission (D6).**

### B1–B2 — Capacitor wrap + native essentials *(parallel, P2 → P4)*
Built **in parallel** starting at P2, hardened by P4. Wrap the same web build
in Capacitor for iOS and Android; wire the additive native features — **push
notifications** (pairs with P2's plumbing) and **haptics** — behind the
graceful-degradation contract from §0. No native-only UI.
- **Exit (by P4):** iOS and Android builds run the identical web experience,
  receive push, and are ready for review.

### RELEASE — submit to App Store + Play Store
Once P4 is live and B1–B2 are hardened: **push notifications on**, submit to
**both** stores. This is the first time the product touches a store (D6) — and
by design it clears Apple's minimum-functionality bar (§3.3).

### Post-launch — grow + measure retention
Grow the player base; measure retention. **This gates P6** (D7): no store until
retention is proven.

### P6 — Monetization *(only after retention is proven)*
**Skins/themes as code:** sprites are draw-functions; a skin = an alternate
palette/detail set behind a `skinId`. Server owns *ownership*; client owns
*rendering*. Cosmetic only — zero engine/balance impact. `entitlements`,
`store_items`, `transactions`. **Three payment rails** (Apple IAP, Google Play
Billing, Stripe) all granting the **same** server-side entitlement (parity).
- **Exit:** a player buys and equips a skin on one platform; ownership survives
  reinstall and shows up on every other platform.

### Later — Blitz mode (3s/turn real-time)
Highest latency demands, deliberately after ranked correspondence proves the
infra. Tight server clock, sub-second broadcast, RTT-based timer grace,
aggressive reconnection; likely a dedicated low-latency game-server process
colocated by region, plus move-buffering UX so 3s feels fair.
- **Exit:** a blitz ladder that feels responsive at ~100ms RTT.

### Cross-cutting (every phase)
- **Anti-cheat:** server authority via the engine is the whole game here. Also
  rate limits, server-owned clocks, and server-owned RNG seed (combat has a
  deterministic spread — keep the seed server-side).
- **Abuse/fair play:** rage-quit handling, report/mute, connection-drop vs
  forfeit rules.
- **Observability:** match logs are just command logs — replays and debugging
  are nearly free. Spectating later = subscribe read-only.
- **Privacy/compliance:** minimal PII (anon-first helps); a **hosted privacy
  policy is required before store submission** and before any payments.

---

## 7. Data model sketch (Postgres)

- `profiles(id, handle, kind[anon|user], avatar, cosmetic_loadout, created_at)`
- `matches(id, mode, timer_kind, status, red_id, blue_id, map_ref, fog,
  ranked, created_at, ended_at, winner)`
- `moves(match_id, seq, actor, command_jsonb, server_ts)` — append-only;
  the match *is* its command log (replay = re-run the engine).
- `clocks(match_id, red_ms, blue_ms, turn_started_ts)`
- `ratings(profile_id, season_id, mode, rating, rd, vol, games)`
- `seasons(id, starts, ends)`
- `entitlements(profile_id, item_id, acquired_at, provider)` — one row per
  owned cosmetic, regardless of which rail (Apple/Google/Stripe) paid for it.
- `store_items(id, kind[skin|theme|effect], price, meta)`
- `transactions(id, profile_id, item_id, provider[apple|google|stripe],
  amount, status)`
- `push_tokens(profile_id, platform[web|ios|android], token, updated_at)`

Note how `moves` mirrors `serialize.ts` exactly — the wire format and the
storage format are the same command log we already ship.

---

## 8. Design questions to settle per phase (not blockers now)

- **Turn timeout policy:** auto-resign vs auto-skip-turn vs a per-game
  "reserve" bank (chess-style increment). Blitz probably wants a small reserve
  + increment; correspondence wants auto-skip a few times then resign.
- **Progress-sync merge rules:** how to reconcile local guest progress with an
  existing account on first sign-in (union of unlocks is the likely default).
- **Map pool for ranked:** which maps are ladder-legal; do custom `#map=`
  links stay unranked (recommended: yes, ranked uses a curated pool).
- **Fog in ranked:** fog vs no-fog as separate queues/ratings, or one.
- **Disconnect fairness:** grace window, reconnect vs forfeit, clock behavior
  while disconnected.
- **Region/latency for blitz:** how many regions, matchmaking by region.

---

## 9. Rough cost / effort shape

- **Supabase free tier** covers P0–P4 for a small player base; paid tier
  (~$25/mo) when active users grow. Blitz may add a small always-on
  game-server (a cheap VPS or Fly.io/Railway instance) later.
- **Effort ordering** is front-loaded: P0–P2 (foundation + spine) is the bulk
  of the risk. P3–P4 are additive product work. The Capacitor wrap (B1–B2) is
  parallel plumbing. P6 (store) is mostly plumbing + content. Blitz is a
  focused latency project.

---

## 10. Parked items (external, owner: you)

These gate parts of the roadmap but live outside the code:

1. **Supabase project** (needed at **P0/P1**) — needs your account.
2. **Apple Developer license** ($99/yr) — needed **near release**: App Store
   presence, Sign in with Apple (D2/§3.2), and iOS IAP (P6).
3. **Google Play Developer account** ($25 one-time) — needed **near release**:
   Play Store presence, Google login, and Play Billing (P6).
4. **Hosted privacy policy** — required **before store submission** (and before
   any payments/analytics that touch PII).
5. **Payment providers (P6, deferred):** Stripe (web) + the two store billing
   setups. **AdMob is deferred to P6** and only if we ever add ads — currently
   out of scope (cosmetics-only monetization).
6. **Recreate the trivial README "live URL" commit** — the tiny doc commit
   noting the live GitHub Pages URL, lost in an earlier merge/rebase; re-add it.

---

## 11. Immediate next build step

**P0 — extract `src/engine` into `packages/engine`** as a shared,
framework-free package: the existing engine tests move with it, the web app
imports it as `@crossfire/engine`, and a stub server build imports the same
package to validate a real command. It's mechanical, unlocks everything else,
and is fully verifiable without any backend account.
</content>
</invoke>
