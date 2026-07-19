# Crossfire Valley — Competitive PvP Overhaul Roadmap

Status: **planning**. This document plans the shift from a fully serverless
game to an online competitive platform with accounts, matchmaking, live
timed play, ranked MMR, and monetization. Nothing here is built yet.

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

We do **not** rewrite the engine. We wrap it in a server and a transport.

---

## 2. Decisions (recommended defaults — easy to redirect)

| # | Decision | Recommended default | Why |
|---|----------|---------------------|-----|
| D1 | Monetization stance | **Cosmetics-first, no pay-to-win; build currency/entitlement hooks early, add optional rewarded-ads + "remove ads" later** | Protects ranked credibility; our sprites are *code*, so skins are cheap; hooks-now/decide-later keeps options open |
| D2 | Backend | **Supabase** (managed Postgres + auth + realtime + edge functions) | Fastest to ship solo; real SQL for MMR/leaderboards; generous free tier; self-hostable escape hatch; fits the validate-with-engine model |
| D3 | First live mode | **Correspondence first** (long + 5-min/turn), **blitz (3s) last** | Lowest latency risk; proves accounts + matchmaking + server authority before chasing millisecond timing |
| D4 | Auth model | **Anonymous-first**, upgrade to social (Google/Apple) | Lowest friction for a link-first game; guests play instantly, upgrade to save progress + play ranked |

These four are the product's load-bearing choices. Change any and the phases
below adjust, but the phase *ordering* stays the same.

---

## 3. Guiding principles

1. **Never break what works.** Serverless play-by-link and local modes
   (campaign, vs-AI, hotseat) keep working forever, offline. Online is
   additive, gated behind login.
2. **Server-authoritative for anything ranked.** The client proposes
   commands; the server validates with the engine and owns the clock and
   the resulting state. No trust in the client.
3. **No pay-to-win, ever.** Every purchasable thing is cosmetic or
   convenience-that-doesn't-touch-balance. This is non-negotiable for a
   ranked strategy game's reputation.
4. **Ship a spine, then widen.** Get one real ranked correspondence match
   working end-to-end before adding blitz, seasons, or a store.

---

## 4. Architecture at a glance

```
          ┌─────────────────────────────────────────────┐
Client    │  existing static PWA (renderer, UI, engine)  │
(browser/ │  + online layer: auth, ws client, store UI   │
 PWA)     └───────────────┬─────────────────────────────┘
                          │  websockets (commands + clock)
                          │  https (auth, matchmaking, store)
          ┌───────────────▼─────────────────────────────┐
Backend   │  Realtime game server (authoritative)         │
(Supabase │   - runs @crossfire/engine to validate moves  │
 + a small │   - owns turn clocks, timeouts, results       │
 game-     │  Postgres: users, matches, moves, ratings,    │
 server)   │            entitlements, currency, seasons    │
          │  Auth (anon + OAuth) · Matchmaking · Store     │
          └───────────────────────────────────────────────┘
```

**Key refactor enabling all of this:** extract the engine into a shared
package (e.g. `packages/engine`) imported by both the client and the server,
so both run byte-identical rules. This is a mechanical move (the engine has
no DOM/browser deps already) and is Phase 0's first task.

---

## 5. Phased roadmap

### Phase 0 — Monorepo + engine package + backend skeleton
*Foundation. No player-visible change yet.*
- Split repo into `packages/engine` (pure rules, shared) and `apps/web`.
- Stand up Supabase project: Postgres, Auth (anonymous enabled), a
  `hello`-level edge function that imports the engine and validates a move.
- CI: engine tests run once, both apps consume the package.
- **Exit:** server can validate a real command with the shared engine.

### Phase 1 — Accounts + profiles
- Anonymous-first login; "upgrade to Google/Apple" to persist.
- `users` / `profiles` tables: handle, avatar, created_at, cosmetic loadout.
- Tie existing local progress (campaign unlocks) to the account when logged
  in; keep localStorage fallback for guests/offline.
- **Exit:** a player has a durable identity across devices.

### Phase 2 — Server-authoritative correspondence matches
*The spine. Reuses the play-by-link model, but the server is the referee.*
- `matches` + `moves` tables (append-only command log per match).
- Realtime channel per match; client sends a command, server validates via
  engine, appends it, broadcasts, updates whose-turn.
- Turn clock: server timestamps; **5-min-per-turn** and **24h-per-turn**
  presets; timeout = auto-resign or skip (design choice, see §7).
- Reconnect = re-subscribe and replay the command log (we already do this).
- **Exit:** two logged-in players complete a timed correspondence game the
  server refereed, survivable across disconnects.

### Phase 3 — Matchmaking + unranked live queue
- "Find match" queue with presence; pair by simple criteria first.
- Lobby / challenge-a-friend by handle or link.
- **Exit:** press a button, get paired with a stranger, play.

### Phase 4 — Ranked + MMR + seasons
- **Glicko-2** rating (better than Elo for irregular play; tracks rating +
  deviation + volatility). Compute server-side after each ranked result.
- `ratings` (per season, per mode), `seasons`, leaderboard views.
- Matchmaking pairs by rating + deviation; placement matches; soft resets
  per season; leaderboards.
- **Exit:** ranked ladder with visible rank, MMR-based pairing, a season.

### Phase 5 — Blitz mode (3s/turn real-time)
*Highest latency demands — deliberately last, on proven infra.*
- Tight server clock, sub-second broadcast, lag compensation for the timer
  (grace based on measured RTT), aggressive reconnection.
- Likely a dedicated low-latency game-server process (Node + ws) rather than
  edge functions, colocated by region.
- Pre-planning / move-buffering UX so 3s feels fair.
- **Exit:** a blitz ladder that feels responsive at ~100ms RTT.

### Phase 6 — Monetization
*Hooks land earlier (Phase 1 loadout, Phase 4 entitlement checks); the store
 turns on here.*
- **Skins as code:** sprites are draw-functions; a skin = an alternate
  palette/detail set behind a `skinId`. Server owns *ownership*; client owns
  *rendering*. Cosmetic only — zero engine/balance impact.
- `entitlements`, `currency`, `store_items`, `transactions`. Server-side
  ownership checks; never trust the client for what you own.
- Payments: platform IAP on mobile (needs Apple Developer license — parked),
  Stripe on web. Start with a couple of skin sets + a board theme.
- Optional (per D1): rewarded video for soft currency + one-time "remove
  ads" — as a **later, opt-in** layer, never in ranked flow-breaking spots.
- **Exit:** a player buys and equips a skin; ownership survives reinstall.

### Cross-cutting (every phase)
- **Anti-cheat:** server authority via the engine is the whole game here.
  Also: rate limits, move legality already enforced, server-owned clocks,
  server-owned RNG seed (our combat has a deterministic spread — keep the
  seed server-side).
- **Abuse/fair play:** rage-quit handling, report/mute, connection-drop vs
  forfeit rules.
- **Observability:** match logs are just command logs — replays and
  debugging are nearly free. Add spectating later (subscribe read-only).
- **Privacy/compliance:** minimal PII (anon-first helps), a privacy policy
  before payments/ads, region considerations for ranked.

---

## 6. Data model sketch (Postgres)

- `profiles(id, handle, kind[anon|user], avatar, created_at)`
- `matches(id, mode, timer_kind, status, red_id, blue_id, map_ref, fog,
  ranked, created_at, ended_at, winner)`
- `moves(match_id, seq, actor, command_jsonb, server_ts)` — append-only;
  the match *is* its command log (replay = re-run the engine).
- `clocks(match_id, red_ms, blue_ms, turn_started_ts)`
- `ratings(profile_id, season_id, mode, rating, rd, vol, games)`
- `seasons(id, starts, ends)`
- `entitlements(profile_id, item_id, acquired_at)`
- `currency(profile_id, balance)`
- `store_items(id, kind[skin|theme|effect], price, currency_kind, meta)`
- `transactions(id, profile_id, item_id, provider, amount, status)`

Note how `moves` mirrors `serialize.ts` exactly — the wire format and the
storage format are the same command log we already ship.

---

## 7. Design questions to settle per phase (not blockers now)

- **Turn timeout policy:** auto-resign vs auto-skip-turn vs a per-game
  "reserve" bank (chess-style increment). Blitz probably wants a small
  reserve + increment; correspondence wants auto-skip a few times then
  resign.
- **Map pool for ranked:** which maps are ladder-legal; do custom `#map=`
  links stay unranked (recommended: yes, ranked uses a curated pool).
- **Fog in ranked:** fog vs no-fog as separate queues/ratings, or one.
- **Disconnect fairness:** grace window, reconnect vs forfeit, clock behavior
  while disconnected.
- **Region/latency for blitz:** how many regions, matchmaking by region.

---

## 8. Rough cost / effort shape

- **Supabase free tier** covers Phases 0–4 for a small player base; paid
  tier (~$25/mo) when active users grow. Blitz may add a small always-on
  game-server (a cheap VPS or Fly.io/Railway instance) in Phase 5.
- **Effort ordering** is front-loaded: Phase 0–2 (foundation + spine) is the
  bulk of the risk. Phases 3–4 are additive product work. Phase 5 (blitz) is
  a focused latency project. Phase 6 (store) is mostly plumbing + content.

---

## 9. Updated parked items (owner: you)

These gate parts of the roadmap but are external to the code:

1. Rename repo → `crossfire-valley` (Settings → General).
2. Open PR / merge the feature branch to `main`.
3. Enable GitHub Pages (Settings → Pages → Source: GitHub Actions; public
   repo or Pro).
4. **Apple Developer license** ($99/yr) — required for App Store presence and
   for iOS in-app purchases (Phase 6 mobile monetization) and Apple sign-in
   (D4). Also unblocks the earlier PWA→store path.
5. Create the Supabase project (Phase 0) — needs your account.
6. Payment providers (Phase 6): Stripe account (web) + store developer
   accounts (mobile).

---

## 10. Recommended next build step

**Phase 0, task 1:** extract `src/engine` into `packages/engine` as a shared,
framework-free package, with the existing 54 tests moving with it and both a
web build and a (stub) server build importing it. It's mechanical, unlocks
everything else, and is verifiable without any backend account. Say the word
and I'll do it.
