# Monetization: the $1.99 full-game unlock

Decided (see MASTER_PLAN §5): one non-consumable purchase, no ads.

| Free forever | Full game ($1.99, once) |
|---|---|
| Act I (missions 1–12) | Acts II and III (missions 13–24) and every future Book |
| Boot Camp | Every skirmish map vs the computer or by link |
| Crossfire Valley skirmish, any opponent | Map editor: play vs the computer and share links |
| Local two-player on any map | |

## How it works in the code

- `src/ui/entitlements.ts` owns everything: the free-tier rules
  (`missionNeedsUnlock`, `skirmishNeedsUnlock`), the owned flag
  (`crossfire-valley-unlocked` in local storage), the developer switch,
  and the store adapter.
- The store is RevenueCat's Capacitor plugin, reached with
  `registerPlugin('Purchases')`. Until the plugin is installed and a key is
  set, every store call fails soft: the unlock screen says "Not available
  yet" and nothing crashes.
- Gates: campaign map and list (`Full game` tags, tapping opens the unlock
  screen), the briefing, skirmish Start, and the editor's Share button.
- The developer switch (Settings → "Developer: treat the full game as
  owned") only exists on the dev server and in the debug APK
  (`VITE_DEV_UNLOCK=1` in `.github/workflows/android.yml`). Release builds
  never show it.

## Turning the store on (James)

Order matters; each step needs the one before it.

1. **Store products.** In App Store Connect (after the Apple Developer
   enrollment) create a *Non-Consumable* in-app purchase with product id
   `crossfire_unlock`, price tier $1.99, display name "Full game". In the
   Play Console create a one-time *in-app product* with the same id and
   price. Both need a short description and, for Apple, a review
   screenshot (the unlock screen works).
2. **RevenueCat.** Create a free RevenueCat project, add the iOS and
   Android apps (bundle id `com.fourcraftybrothers.crossfirevalley`), connect
   the store credentials it asks for, then:
   - create an **entitlement** with identifier `full_game`;
   - attach both `crossfire_unlock` products to it;
   - create the default **offering** with one package containing both
     products.
3. **Keys.** Copy the two *public SDK keys* (iOS `appl_…`, Android
   `goog_…`) into GitHub → Settings → Secrets → Actions as
   `REVENUECAT_IOS_KEY` and `REVENUECAT_ANDROID_KEY`. The release
   workflows already pass them to the build.
4. **Install the plugin** (a PR Claude can do once steps 1–3 exist):
   `npm install @revenuecat/purchases-capacitor` then
   `npx cap sync`. This adds the native code; nothing else in the app
   changes, because it already talks to the plugin by name.
5. **Privacy policy.** Add a line to `public/privacy.html`: purchases are
   processed by Apple / Google and verified by RevenueCat, which receives
   an anonymous app user id and the purchase receipt. No other data.
6. **Test.** Use a TestFlight build with a sandbox Apple account, and a
   Play internal-testing track with a license-tester account. Buy, delete
   the app, reinstall, and use *Restore purchase*.

## Later

A second $0.99 purchase for Book IV is an option if the free tier
converts well. Decide with data, not now.
