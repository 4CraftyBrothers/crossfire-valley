# Store listing kit

Everything the Google Play Console and App Store Connect forms ask for,
pre-answered for what the app actually does. Keep it in sync with the game:
if online accounts or ads are ever added, the data-safety answers change.

Never mention other games by name in the listing (Advance Wars, Battalion,
etc.) — that's a trademark problem and a rejection risk.

## Identity

| Field | Value |
|---|---|
| App name | Crossfire Valley |
| Package / bundle id | `com.fourcraftybrothers.crossfirevalley` |
| Category | Games → Strategy |
| Privacy policy URL | `https://<owner>.github.io/crossfire-valley/privacy.html` (served from `public/privacy.html` once Pages is enabled) |
| Website | the Pages URL |
| Contact email | jameshecker@icloud.com |

## Short description (Play, ≤ 80 chars)

> Turn-based tank tactics. 12-mission campaign, fog of war, no ads, no account.

## Full description

> Command the Red army across a twelve-mission campaign of turn-based tactics.
> Every unit has a job: infantry capture cities, bazookas stop tanks, recon
> scouts ahead, artillery pounds from range, helicopters cross anything, and
> anti-air brings them down. Terrain matters — dig into forests, hold the
> mountain pass, control the bridge.
>
> • 12-mission campaign with a guided tutorial, defensive stands, land grabs,
>   and a fog-of-war finale
> • Three AI difficulties for skirmishes on the included map or your own
> • Earn up to three stars per mission
> • Built-in map editor — build a map and share it as a link
> • Local two-player on one device, or play a friend by sending a link
> • Plays fully offline. No ads, no accounts, no data collection.
>
> Small download, big income war.

## Screenshots

Take them on real devices at the store's required sizes. Suggested set:

1. Mission briefing screen (Campaign → a mid-campaign mission)
2. Mid-battle with the action bar open (Attack / Capture / Wait)
3. Fog-of-war mission with the tutorial-style objective hint visible in the HUD
4. Campaign list with medals
5. Landscape phone layout
6. Tablet layout

Play also wants a **feature graphic** (1024 × 500 PNG, no transparency). Use
the tank icon on the dark green background with the name set large.

## Google Play — Data safety form

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | N/A (no data collected) |
| Do you provide a way for users to request that their data is deleted? | N/A |

Permissions declared: only `INTERNET` (Capacitor default; used solely if the
player opens a share link). No location, contacts, camera, storage, or ads.

## Google Play — Content rating (IARC questionnaire)

- Violence: *cartoon or fantasy violence* — stylised military units fire on
  each other; units are destroyed with a small explosion. No blood, gore, or
  realistic depictions.
- Everything else (sexual content, language, controlled substances, gambling,
  user interaction, personal info sharing, location): **No**.
- Expected rating: Everyone 10+ / PEGI 7.

Target audience: **not** designed for children under 13. Do not enrol in the
"Designed for Families" programme (it adds requirements you don't need).

## App Store — App Privacy (nutrition label)

**Data Not Collected.** Select "No, we do not collect data from this app."

## App Store — Age rating

- Cartoon or Fantasy Violence: **Infrequent/Mild**
- All other categories: None
- Expected: **9+**

## App Store — App Review notes

> Single-player strategy game. No account or sign-in. To reach the campaign
> tap Campaign → First Steps → Start mission. The optional "Online link" mode
> exchanges game state through a URL the player shares manually; no server is
> involved.

## Release checklist

**Both**
- [ ] Contact email filled into `public/privacy.html` and the listing
- [ ] GitHub Pages enabled so the privacy URL resolves
- [ ] `version` in `package.json` and `versionName` in `android/app/build.gradle` agree (and `CFBundleShortVersionString` in `ios/App/App/Info.plist`)

**Google Play**
- [ ] Play developer account ($25 one-time)
- [ ] Run **Android release** workflow once with `make_keystore`, save the artifact contents as the `ANDROID_KEYSTORE_BASE64` secret, delete the artifact
- [ ] Push a `v0.2.0` tag → download `app-release.aab` from the run
- [ ] Create the app in Play Console; upload the `.aab` to Internal testing first
- [ ] Complete Data safety, Content rating, Target audience, Ads (No)
- [ ] Promote to Production when the internal test is clean

**Apple App Store** (no Mac needed — `.github/workflows/ios-release.yml` does the Mac part)
- [ ] Apple Developer membership ($99/yr) at developer.apple.com — approval takes a day or two
- [ ] App Store Connect → Users and Access → Integrations → App Store Connect API → generate a Team Key with **Admin** access; download the `.p8`, note the Key ID and Issuer ID
- [ ] Add the four repository secrets listed at the top of `ios-release.yml` (Key ID, Issuer ID, `.p8` contents, Team ID)
- [ ] Actions → **iOS TestFlight** → Run workflow. The first run creates the app record and uploads build 1 to TestFlight
- [ ] On the iPhone: install **TestFlight** from the App Store, accept the email invite, install Crossfire Valley
- [ ] In App Store Connect: App Privacy = Data Not Collected; Age rating as above; screenshots; description from this file
- [ ] Add the TestFlight build to a version and **Submit for Review**

If "Crossfire Valley" is already taken as an App Store name, change `IOS_APP_NAME` in the workflow (the bundle id can stay).
