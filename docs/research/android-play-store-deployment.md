# Deploying ForestPoker to Google Play

Research date: 2026-11-14. Repo state: `main` at `12fbf91` (v0.35.0). Next.js 16.2.6 (`package.json:24`); Next docs read from `node_modules/next/dist/docs/`.

Every external claim cites a primary source (see [Sources](#sources)). Repo facts are cited as `path:line`. Anything marked **Inference** is my own reasoning and is not in a source.

---

## TL;DR

- **Recommended path: a Trusted Web Activity (TWA) built with Bubblewrap**, pointing at the existing Firebase App Hosting deployment. ForestPoker is a server-rendered Next.js app. It uses Server Actions, cookies, request-reading route handlers and dynamic routes. The Next docs list all of these as unsupported in a static export, so Capacitor (which bundles static files) or a static rebuild would mean rewriting the app. A TWA runs the live site in Chrome, so the server architecture, the Firebase Google sign-in and the session cookie keep working unchanged. Web deploys reach Android users without a new AAB.
- **Effort (Inference):** about 2–4 developer-days of code in this repo (manifest, icons, service worker with an offline page, `assetlinks.json`, privacy policy page, account deletion). Add about a day of console and listing work. Then the calendar time is driven by Google: at least **14 consecutive days of closed testing with 12 or more opted-in testers** for a new personal account, then a production-access review of usually 7 days or less. Realistic total: **3–5 weeks**.
- **Gambling-policy verdict (Inference, moderate confidence):** ForestPoker is **not a "Gambling App"** under Google Play's Real-Money Gambling policy, and it is **not simulated gambling**. It records buy-ins and buy-outs from in-person cash home games and computes who owes whom. It never takes, holds or moves money, offers no wagering and has no payments. The policy targets apps that "enable or facilitate" online gambling or that "accept or manage wagers… winnings, or deposits". A reviewer *could* read a buy-in ledger as "managing wagers". So present it as a settle-up and expense tracker, target 18+ only, add no gambling ads or links, and answer the IARC questionnaire carefully. No gambling licence or Google gambling application should be needed.
- **Biggest blockers:**
  1. **The whole app is one global league.** Any signed-in user can see every game, ledger, location and standing (`src/actions/games.ts:417-437`, `src/db/schema.ts:50`). A public Play listing would let strangers sign up and see the group's real names, locations and money history. Before a *public* release you need an invite or allowlist gate (or multi-league support). Alternatively, ship only on a closed or internal test track.
  2. **Account deletion is required and doesn't exist.** You need both an in-app path and a web URL. Also, `settlements.from_user_id`/`to_user_id` and `games.created_by` have no `ON DELETE` cascade (`src/db/schema.ts:72-75`, `143-148`), so deleting a user means anonymizing rows rather than doing a simple row delete.
  3. **No PWA yet.** There is no manifest, no service worker and no PNG icons (`public/` holds only Next starter SVGs; `src/app/` has only `favicon.ico` and `icon.svg`).
  4. **No privacy policy.** It is required for the Data safety form and must also be linked inside the app.
  5. **Domain.** Production runs on the App Hosting URL (example in `README.md:73`). The TWA is bound to that origin through Digital Asset Links, so pick a custom domain *before* publishing. Moving it later means shipping a new AAB.
- **Cheaper alternative if the goal is only "on the group's phones":** make it an installable PWA (the same code changes minus `assetlinks.json`) and skip Play entirely. Or use a Play **internal test** track: up to 100 testers, no Data safety form, possibly no full policy review.

---

## 1. App facts relevant to the decision (verified from the repo)

| Fact | Evidence |
|---|---|
| Purpose: track poker **buy-ins / buy-outs in whole NIS** for a home-game group, with settlement transfers | `README.md:3`, `GLOSSARY.md:3`, `GLOSSARY.md:21-27` |
| Real-money amounts are *recorded*, not handled: ledger rows store `amount_nis`; settlement is computed with a greedy min-transfer algorithm | `src/db/schema.ts:120-153`, `src/lib/settlement.ts:1-60`, `src/lib/formatMoney.ts:4-15` (ILS currency) |
| **No payments, IAP, wallets or payment SDKs** in dependencies | `package.json:18-30` |
| **No analytics or trackers** (grep for gtag/analytics/sentry/posthog/mixpanel found nothing) | `src/`, `package.json` |
| Rendering: Next.js App Router, **server-rendered**, `output: "standalone"` for App Hosting / Cloud Run | `next.config.ts:9` |
| Server Actions | `src/actions/games.ts:1`, `src/actions/onboarding.ts:1`, `src/actions/player.ts:1` |
| Route handlers that read the request and cookies (POST/DELETE session, `/api/me`, digest polling with ETag) | `src/app/api/auth/session/route.ts:14-64`, `src/app/api/me/route.ts:10`, `src/app/api/realtime/digest/route.ts:59-78` |
| Cookie-based session (`__session`, 5 days) verified server-side with Firebase Admin | `src/lib/auth/session.ts:7-29` |
| Dynamic route without `generateStaticParams` (`/[locale]/games/[gameId]`); only the locale layout has it | `src/app/[locale]/layout.tsx:24-26`, `src/app/[locale]/games/[gameId]/page.tsx:33` |
| i18n middleware (`middleware.ts`, deprecated name for `proxy` in this Next version). The matcher skips any path containing a dot, so `/.well-known/assetlinks.json` would bypass locale redirects | `middleware.ts:7-9`; `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11` |
| Auth: Firebase Auth, email/password + Google via **`signInWithPopup`**, falling back to `signInWithRedirect` | `src/components/LoginForm.tsx:241-299`, `README.md:8` |
| COOP header `same-origin-allow-popups` for the Firebase popup | `next.config.ts:23-35` |
| The app already detects "embedded" browsers (iframes, Electron, vscode-webview) and disables Google sign-in there | `src/lib/auth/oauthEnvironment.ts:5-16`, `src/components/LoginForm.tsx:257,354` |
| Data: Neon Postgres via Drizzle. Users store email, username, display name, preferred locale and a free-text "location" (meeting spot, *not* device GPS) | `src/db/schema.ts:24-42` |
| User-entered text visible to other users: game notes (≤500 chars), game/venue location, usernames | `src/actions/games.ts:40,64-72`, `src/db/schema.ts:82-84` |
| **One global league**: listing, standings and settings are not scoped by membership | `src/actions/games.ts:417-437`, `src/actions/games.ts:696-712`, `src/db/schema.ts:50-64` |
| Optional Twilio WhatsApp settlement message to one configured number (third-party processor) | `README.md:47-54`, `src/lib/whatsapp/sendTwilioWhatsApp.ts:8-10` |
| Hosting: Firebase App Hosting, backend `forest-poker`, project `forest-poker-web-a8k3`, deployed by GitHub Actions on push to `main` | `firebase.json:2-4`, `.firebaserc:3`, `.github/workflows/deploy-firebase-main.yml:25-88` |
| Production host: App Hosting URL, e.g. `forest-poker--forest-poker-web-a8k3.us-east4.hosted.app` (no custom domain found in the repo) | `README.md:73` |
| Locales `en` (default) and `he` (RTL) | `src/i18n/routing.ts:4-5`, `src/app/[locale]/layout.tsx:51` |
| No web app manifest, service worker, privacy policy, terms or account deletion exist | grep of `src/`, `public/`, `messages/` |
| No age gate | `src/components/LoginForm.tsx`, onboarding |

---

## 2. Packaging options compared

### What Next.js 16 allows (verified, `node_modules/next/dist/docs`)

`01-app/02-guides/static-exports.md:274-291` lists these as **unsupported with `output: 'export'`**:

- Dynamic routes without `generateStaticParams()`
- Route Handlers that rely on Request
- Cookies
- Proxy
- Server Actions

Line 251 adds: "If you need to read dynamic values from the incoming request, you cannot use a static export." ForestPoker uses every one of these (§1).

### Options

| Option | What it requires of *this* codebase | Verdict |
|---|---|---|
| **TWA (Bubblewrap / PWABuilder)** | A web manifest, 192 and 512 px icons, HTTPS (already), `/.well-known/assetlinks.json`, and a service worker offline fallback. No change to rendering, auth or hosting. Content is "rendered by the user's browser… run fullscreen" ([TWA overview, Android](#s-twa-android)). Requires Chrome 72+ ([TWA overview](#s-twa-chrome)). | **Recommended.** |
| **Capacitor, bundled** | `webDir` must hold the compiled web assets with a final `index.html` ([Capacitor config](#s-cap-config)). That means `output: 'export'`, which rules out Server Actions, cookies, request handlers and dynamic `[gameId]`. You would need to rewrite to a client-only SPA plus a separately hosted API, and replace cookie auth with bearer tokens. | Rewrite; not justified. |
| **Capacitor with `server.url`** (remote site in a WebView) | Docs: `server.url` is "intended for use with live-reload servers" and "**This is not intended for use in production.**" ([Capacitor config](#s-cap-config)). Google sign-in would also break (next row). | Not supported for production. |
| **Plain Android WebView wrapper** | Google OAuth policy: "A developer must not direct a Google OAuth 2.0 authorization request to an embedded user-agent under the developer's control" ([OAuth policies](#s-oauth)). Google sign-in (`LoginForm.tsx:276`) would need a native Credential Manager / Google Sign-In bridge. Play also flags thin website wrappers (see §5.4). | Worse than a TWA on every axis. |
| **React Native / native rewrite** | Rewrite all UI; keep Postgres behind a new API. | Months of work. Not justified for a group tracker. |

**Inference:** A TWA renders in Chrome, not an app-controlled WebView, so the Firebase popup/redirect flow and the `__session` cookie should behave as they do in mobile Chrome. `isIdeEmbeddedPreview()` checks for iframe, Electron or vscode-webview user agents and should not trigger in a TWA. **This must be tested on a device**, in particular `signInWithPopup` with the COOP header, and the redirect fallback.

---

## 3. TWA specifics

### 3.1 PWA installability (needed before Bubblewrap `init`)

A TWA is expected to meet the same Add-to-Home-Screen requirements, auditable with Lighthouse ([TWA overview, Android](#s-twa-android)). Chrome's install criteria ([web.dev install criteria](#s-install)):

- HTTPS
- A manifest with `short_name` or `name`
- `icons` including **192 px and 512 px**
- `start_url`
- `display` set to `fullscreen`, `standalone`, `minimal-ui` or `window-controls-overlay`
- `prefer_related_applications` absent or `false`

Next.js support: put `app/manifest.ts` (or `manifest.json`) in the root of `app/` ([`01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`]). The Next PWA guide also says installability needs "a valid web app manifest" and "HTTPS" (`01-app/02-guides/progressive-web-apps.md:586-591`). In this repo that is `src/app/manifest.ts`. `start_url` should probably be `/` (the middleware locale-redirects it) or `/en/games`. **Inference:** `/` keeps the Hebrew locale-detection behaviour.

### 3.2 TWA quality criteria (offline / errors)

Chrome documents three conditions that apps must handle "to prevent them from crashing" ([What's new for Web in Play](#s-whatsnew), published 2020-12-02, no newer revision found):

1. Failure to verify Digital Asset Links at launch.
2. Failure to return HTTP 200 for an offline request.
3. An HTTP 404 or 5xx inside the app.

→ Add a service worker (`public/sw.js`) with an offline fallback page. The Next PWA guide shows registering a `public/sw.js`, and says to serve it with `Cache-Control: no-cache, no-store, must-revalidate` (`progressive-web-apps.md:545,655-660`). **Unverified:** whether Chrome in late 2026 still enforces these as crashes. The only dated source is from 2020.

### 3.3 Digital Asset Links and Play App Signing

- Host `https://<domain>/.well-known/assetlinks.json`. Requirements: served as `application/json`, over HTTPS, **with no redirects** ([Configure assetlinks](#s-assetlinks)). Format:
  ```json
  [{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "<applicationId>",
      "sha256_cert_fingerprints": ["<SHA-256>"]
    }
  }]
  ```
- **Play App Signing changes the fingerprint.** The certificate from local `keytool` "will usually not match the one on users' devices". The correct snippet is in Play Console under **App signing** ([Configure assetlinks](#s-assetlinks)). Current menu path: **Play Console > Protected with Play > Play Store protection > Manage Play app signing**, "App signing key" section. With quantum-ready hybrid signing **there are three fingerprints to copy** ([Play App Signing](#s-signing)). Put both the upload-key and app-signing-key fingerprints in the array (multiple values are supported).
- The association must be set up in both directions. The app side is an `asset_statements` resource that Bubblewrap generates ([Integration guide](#s-integration)). If verification fails, the URL bar stays visible ([Integration guide](#s-integration)). Debug with `adb logcat | grep -e OriginVerifier -e digital_asset_links`.
- **In this repo:** `public/.well-known/assetlinks.json`. Next serves `public/x` at `/x` (`01-app/03-api-reference/03-file-conventions/public-folder.md`), and the middleware matcher skips dotted paths (`middleware.ts:8`). **Caveat:** the `standalone` server "does not copy the `public` or `.next/static` folders by default" (`01-app/03-api-reference/05-config/01-next-config-js/output.md:36`). The existing deploy presumably handles `public/` already, through the App Hosting adapter, but this is **unverified**. Check after deploy with `curl -sI https://<domain>/.well-known/assetlinks.json` (expect 200, `application/json`, no 3xx).

### 3.4 Bubblewrap tooling (verified)

- `npm i -g @bubblewrap/cli`. Latest is **1.27.0** on npm (registry modified 2026-10-09). Needs Node ≥ 18 and **JDK 17** exactly; Android command-line tools in a path without spaces ([Bubblewrap CLI README](#s-bw-cli)).
- `bubblewrap init --manifest="https://<domain>/manifest.webmanifest"`, then `bubblewrap build`. The build produces `app-release-signed.apk` and **`app-release-bundle.aab`** (upload the AAB).
- `bubblewrap fingerprint add <SHA-256>` and `bubblewrap fingerprint generateAssetLinks` produce the assetlinks file. Also available: `bubblewrap update` (regenerate the project or bump the version), `bubblewrap validate --url=…` and `bubblewrap doctor` ([Bubblewrap CLI README](#s-bw-cli)).
- The Bubblewrap template currently sets `compileSdkVersion 36` / `targetSdkVersion 36` ([template build.gradle](#s-bw-gradle)), which meets the 2026 Play requirement (§4).
- The README says Bubblewrap is "not an officially supported Google product" ([Bubblewrap repo](#s-bw)). PWABuilder uses the same core.
- Generate the Android project **outside this repo** (e.g. a sibling `forestpoker-android/` folder or a separate repo). Keep the keystore out of git; this repo already ignores `secrets/` for deploy (`firebase.json:12`).

---

## 4. Play Console account and technical requirements

### 4.1 Account (human-only tasks)

| Item | Current requirement | Source |
|---|---|---|
| Fee | "There is a US$25 one-time registration fee." Prepaid cards are not accepted. | [Register](#s-register) |
| Age / agreement | Must be 18 or older; accept the Developer Distribution Agreement | [Register](#s-register) |
| Identity | May be asked for a government ID and a credit card in your legal name. The fee is not refunded if verification fails. | [Register](#s-register) |
| Personal vs organization | Personal suits individuals and hobbyists. Organization needs a **D-U-N-S number**. An organization account is *required* for financial products and services, health, VPN and government apps. | [Account types](#s-types) |
| Device verification | Personal account owners must verify access to an Android device via the Play Console mobile app | [Register](#s-register) |
| **Closed testing (personal accounts created after 2023-11-13)** | "a minimum of **12 testers** who have been opted in continuously for at least **14 days**". The days must be consecutive. Then use Dashboard → "Apply for production"; review is "usually 7 days or less" | [Testing requirements](#s-testing) |
| Test track limits | Internal: up to 100 testers, might skip standard review, exempt from Data safety. Closed: lists up to 2,000 testers. Open: unlimited. | [Test tracks](#s-tracks) |

**Inference on the Financial Services policy:** it covers products "related to the management or investment of money and cryptocurrencies" and lists loans, EWA and binary options. It does not mention ledgers or bill-splitting ([Financial services](#s-fin)). A settle-up tracker is very unlikely to count, so a **personal account should be fine**.

### 4.2 Build / technical

| Item | Requirement | Source |
|---|---|---|
| Format | New apps must publish as **Android App Bundles** (since Aug 2021) | [App Bundle](#s-aab) |
| Target API | **From 2026-08-31:** new apps and updates must target **Android 16 (API 36)** or higher. Existing apps must target API 35 or higher to stay visible to new users on newer OS versions. The extension ran to 2026-11-01 and has passed. | [Target SDK](#s-target) |
| Signing | New AAB uploads are auto-enrolled in Play App Signing ("quantum-ready, hybrid signing with Google-generated keys"). You keep an **upload key**, which can be reset if lost; Google holds the app signing key. | [Play App Signing](#s-signing) |
| 16 KB page size | Applies to apps with native (`.so`) code. Apps that are only Java/Kotlin "already support 16 KB devices". Play blocks non-compliant updates from **2027-02-01**. **Inference:** a Bubblewrap TWA has no NDK code, so it is not affected; confirm with APK Analyzer (no `lib/` folder). | [Page sizes](#s-16kb) |

---

## 5. Policy

### 5.1 Real-Money Gambling, Games, and Contests: which category is ForestPoker?

What the policy says ([RMG policy](#s-rmg); the page has no "last updated" date, fetched 2026-11-14):

- **Gambling Apps** are allowed "in select countries" only. Requirements: Google's application process, an approved governmental or licensed operator per country, a licence for each jurisdiction, under-age and geo blocking, free to download, **no** Play In-app Billing, an **AO / IARC-equivalent** rating, and responsible-gambling info. Eligible products: online casino, sports betting, horse racing, lotteries, DFS.
- **Other Real-Money Games, Contests, and Tournaments:** "we don't allow content or services that enable or facilitate users' ability to wager, stake, or participate using real money". Listed violations:
  - games that take money for a prize;
  - "BET!"/"REGISTER!"/"COMPETE!" calls to action;
  - "Apps that accept or manage wagers, in-app currencies, winnings, or deposits".
- **Simulated gambling** appears in the *ads* section: apps showing gambling ads "must not provide simulated gambling content (for example, social casino apps; apps with virtual slot machines)". The ads rules also treat "sports score/odds/performance tracking" as gambling "companion functionality" for ad purposes.

**Classification (Inference):**

- **Not a Gambling App.** It does not let anyone gamble online. Play happens in person, money changes hands offline, and the app never accepts, holds or transfers funds (§1: no payment dependencies; `settlement.ts` only *computes* transfers).
- **Not simulated gambling / social casino.** There is no card game, chips economy or virtual currency.
- **Grey zone: "manage wagers… winnings".** The ledger records buy-ins (stakes) and buy-outs. A reviewer could see this as managing wagers. Mitigations:
  - Describe it in the listing as a "home-game expense and settle-up tracker". Avoid "bet", "wager" and "winnings" wording. The app's own glossary already avoids "winnings" (`GLOSSARY.md:45`).
  - No gambling ads, no links to poker sites.
  - Target audience **18+ only** (§5.3).
  - Answer the IARC questionnaire truthfully about gambling references (§5.2).
  - Use the review notes / App access section to explain that no money flows through the app.
- **Also:** the RMG ads rules would apply if you ever add ads. Gambling ads are not allowed for apps in Designed for Families, and require responsible-gambling messaging. Keep the app ad-free.
- **Not verified:** whether recording real-money home-game stakes is legal in Israel or other target countries. Google's policies require compliance with local law; check this separately and consider limiting distribution to Israel.

### 5.2 Content rating (IARC)

- Every app needs an IARC rating: "We don't allow apps without a content rating on Google Play". Unrated apps "will be removed" ([Content ratings](#s-ratings)). Path: Policy > App content → questionnaire → category → submit ([Questionnaire](#s-questionnaire)).
- Gambling-related rating descriptors:
  - "simulated gambling" fits **ESRB Teen**, **PEGI 12** and **IARC 12+**.
  - **ESRB Adults Only** cites "gambling with real currency" ([Questionnaire](#s-questionnaire), [Ratings for users](#s-ratings-users)).
- **Unverified:** the actual questionnaire wording for gambling. It is only visible inside Play Console. **Inference:** pick a non-game category (e.g. Utility/Productivity/Reference-type). Expect questions about whether the app *offers* real-money gambling (answer no) and whether it *references* gambling. A poker reference may raise the rating to 12+/Teen or higher. That is acceptable, since you will target 18+ anyway.

### 5.3 Target audience / Families

- All apps must declare target age groups. If children are included, the Families policy applies ([Target audience](#s-audience)).
- Select **18 and over only**. This also unlocks "Restrict Minor Access". The listing must not suggest a younger audience ([Target audience](#s-audience)).

### 5.4 Webview / minimum functionality

- "Webviews and Affiliate Spam" bans apps whose main function is showing a website "without the site owner's permission" ([Spam policy](#s-spam)). You own the site, and a TWA is the documented first-party path.
- The minimum functionality rule ("Apps should provide a stable, responsive, and engaging user experience"; no "limited functionality") still applies ([Minimum functionality](#s-minfunc)).
- **Inference:** a working offline page and a polished install experience reduce this risk. Even if Play declines the listing, the PWA path still works.

### 5.5 User-generated content

- UGC is content "visible to or accessible by at least a subset of the app's users". Apps limited to a verified group must still offer **in-app reporting of content and users**. One-to-one interaction features require blocking. Users must accept terms defining objectionable content ([UGC policy](#s-ugc)).
- ForestPoker has usernames, game notes and locations visible to others (§1).
- **Inference / open question:** this small amount of free text probably counts. The minimum is: terms of use accepted at onboarding, plus a "report" action on notes and players. A reviewer may not apply UGC rules to such a small feature set, but compliance is cheap.

---

## 6. Store listing and compliance

| Item | Requirement | What ForestPoker needs |
|---|---|---|
| **Privacy policy** | "All apps must post a privacy policy link in the designated field within Play Console" plus a link inside the app. Must be at an "active, publicly accessible and non-geofenced URL", "non-editable", **no PDFs**. Must cover developer contact, data types, sharing, security and retention/deletion ([User data](#s-userdata)). Required to complete Data safety ([Data safety](#s-datasafety)). | New page, e.g. `src/app/[locale]/privacy/page.tsx` (public, no auth), linked from login and the player page. |
| **Data safety form** | Required for all published apps, including closed and open tracks, even if nothing is collected. Covers data types, purposes, encryption in transit, deletion mechanism and third-party SDK data ([Data safety](#s-datasafety)). | **Inference** declarations: Personal info (email, name/username), app activity / other user content (ledger entries, notes, location text). Processors: Firebase Auth, Neon, Firebase App Hosting / Cloud Run, Twilio (if enabled). Encrypted in transit: yes (HTTPS). No ads/analytics. Financial info: likely "no", since these are records of amounts and not payment data, but **review carefully**. |
| **Account deletion** | Apps that allow account creation must offer an in-app deletion path **and** a web link resource, entered in the Data safety form. Associated user data must be deleted (with exceptions you must disclose) ([Account deletion](#s-deletion)). | New server action plus a UI on the player page, and a public `/[locale]/account-deletion` page. Delete the Firebase Auth user via Admin SDK. Delete or anonymize `app_users` (the FKs on `games.created_by` and `settlements.*_user_id` don't cascade, `src/db/schema.ts:72-75,143-148`). `game_members`, `game_rsvps` and `ledger_entries` cascade (`schema.ts:95,112,127`). Decide whether to keep closed-game ledgers under an anonymized "Deleted player" so league history stays balanced, and disclose that. |
| Content rating | §5.2 | Questionnaire |
| Target audience | §5.3 | 18+ only |
| App icon | 512×512, 32-bit PNG with alpha, ≤1024 KB ([Graphic assets](#s-assets)) | New asset |
| Feature graphic | 1024×500, JPEG or 24-bit PNG (no alpha) ([Graphic assets](#s-assets)) | New asset |
| Screenshots | At least 2 to publish, up to 8 per device type. JPEG/PNG, 320–3840 px, long side ≤ 2× short side. 4 or more at ≥1080 px (9:16 = 1080×1920) needed for recommendation surfaces ([Graphic assets](#s-assets)) | Capture from the TWA in both `en` and `he` |
| App access | **Inference:** login-gated, so provide reviewer test credentials in Play Console "App access", and make sure the test account can pass any invite gate you add (blocker 1). | Create a dedicated reviewer account |

---

## 7. Step-by-step checklist

### A. Code changes in this repo (agent-doable)

1. **Decide domain** (human decision; see B1) and add it to Firebase Auth authorized domains (`README.md:71-75`).
2. **Access gate:** an invite code or email allowlist at onboarding, or a per-league scope. Without it, every Play user joins the single league (blocker 1).
3. `src/app/manifest.ts` with `name`, `short_name`, `start_url`, `display: "standalone"`, `theme_color`/`background_color` (from the `--fp-*` tokens), and icons 192, 512 and a maskable 512 PNG in `public/icons/`.
4. `public/sw.js` with a network-first strategy and an offline fallback page. Register it from a client component, and add `headers()` for `/sw.js` per the Next PWA guide. Don't cache authenticated HTML aggressively (**Inference:** cached ledger pages could show stale balances).
5. `public/.well-known/assetlinks.json`, filled in after the first Play upload (fingerprints from Play Console).
6. Privacy policy page (public), linked in-app.
7. Account deletion: server action + UI + public web page. Covers the Firebase Admin `deleteUser` and DB anonymization.
8. Terms of use acceptance at onboarding, plus a "report content/user" affordance (UGC).
9. Optional: a `<meta name="theme-color">` / `viewport` via Next metadata. Check that the safe-area padding (`src/app/[locale]/layout.tsx:56`) looks right in the TWA's fullscreen mode.
10. Verify on device: Google sign-in in the TWA (popup and redirect), session cookie persistence, the Hebrew RTL layout, and `/.well-known/assetlinks.json` returning 200 `application/json` with no redirect.

### B. Human-only (accounts, keys, console)

1. Optionally buy and attach a custom domain in Firebase App Hosting. It becomes permanent for the TWA.
2. Create the Play developer account: US$25, ID verification, personal account, Android device verification via the Play Console app.
3. Install JDK 17 and Bubblewrap. Run `bubblewrap init --manifest=…`, choosing the package id (e.g. `com.<you>.forestpoker`; permanent). Run `bubblewrap build`. **Back up the upload keystore and its passwords** outside git.
4. Create the app in Play Console and upload `app-release-bundle.aab` to **internal testing**. Copy the app-signing SHA-256 fingerprint(s) (all three if hybrid), plus the upload-key fingerprint, into `assetlinks.json`, deploy, and verify the URL bar disappears.
5. Fill in App content: privacy policy URL, App access (reviewer credentials), Ads = none, Content rating questionnaire, Target audience 18+, Data safety (including the deletion URL).
6. Store listing: name, descriptions (settle-up tracker framing; no betting language), icon, feature graphic, screenshots, category.
7. **Closed test:** recruit **≥12 testers** (the poker group plus friends; Google Group recommended), keep them opted in **14 consecutive days**, then **Apply for production** (about 7 days review).
8. Production release. Consider restricting countries to Israel (Inference; see legality open question).

---

## 8. Ongoing maintenance

- **Web changes need no new AAB.** The TWA renders the live site in the browser ([TWA overview](#s-twa-android)). The existing GitHub Actions → App Hosting pipeline (`.github/workflows/deploy-firebase-main.yml`) keeps shipping features to Android users. **Inference:** a breaking change to sign-in, `start_url`, domain or `assetlinks.json` can break the installed app, so treat those paths as a contract.
- **A new AAB is needed** for:
  - an annual target-API bump;
  - app name, icon, splash or theme changes in the Android shell (`bubblewrap update` and rebuild; **Inference** for manifest fields baked in at build time);
  - a domain change;
  - Bubblewrap / android-browser-helper security updates.
- **Target API cadence:** the current rule (API 36 for new apps and updates from 2026-08-31) is set yearly ([Target SDK](#s-target)). **Inference:** expect API 37 around August 2027, so plan a `bubblewrap update` plus rebuild each summer. If you don't, existing users keep the app, but new users on newer Android versions stop seeing it.
- **Policy declarations:** re-submit the content rating questionnaire if content changes ([Content ratings](#s-ratings)). Keep the Data safety form accurate whenever you add an SDK (e.g. analytics or push).
- **16 KB:** not applicable while the shell has no native code. Re-check if you add native plugins ([Page sizes](#s-16kb)).

---

## 9. Open questions and unknowns

1. **Gambling classification is my reading, not Google's ruling.** The policy has no clause about trackers for offline home games. Only Play review (or Play developer support) can confirm it.
2. **Local legality** of real-money home poker record-keeping in Israel and other target markets. Not researched; needs legal input.
3. **IARC questionnaire gambling questions** are only visible inside Play Console; the resulting rating is unknown.
4. **TWA offline/404 "crash" enforcement:** the only primary source is from 2020. Whether Chrome still enforces it in 2026 is unverified. Build the offline fallback anyway.
5. **Firebase `signInWithPopup` inside a TWA** is untested. The redirect fallback exists (`LoginForm.tsx:278-284`). Test on a real device.
6. **Does App Hosting serve `public/` (including dot-folders) for `output: "standalone"`?** Presumed yes, but unverified (§3.3).
7. **Does UGC policy apply** to notes, usernames and locations in a closed group? Probably yes; reporting plus terms is cheap insurance.
8. **Chrome installability and service workers:** the web.dev criteria page fetched does not mention a service worker requirement. Bubblewrap's PWA validation may still check one. Add one regardless (§3.2).
9. **Product question:** is public Play distribution actually wanted, versus internal/closed testing or a plain PWA install for one group? The answer decides whether blocker 1 (the global league) must be solved.

---

## Sources

All fetched 2026-11-14 unless noted. Google help pages showed no "last updated" date.

**Next.js (local, v16.2.6)**
- `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` (Unsupported Features, lines 274-291)
- `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` (lines 18-60, 545-591, 655-660)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (line 11: middleware → proxy)
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md` (line 36)

**Google Play policy and Play Console Help**
- <a id="s-rmg"></a>Real-Money Gambling, Games, and Contests: https://support.google.com/googleplay/android-developer/answer/9877032 (the old `play.google.com/about/restricted-content/gambling/` 301-redirects here)
- <a id="s-register"></a>Register a developer account: https://support.google.com/googleplay/android-developer/answer/6112435
- <a id="s-types"></a>Personal vs organization accounts: https://support.google.com/googleplay/android-developer/answer/13634885
- <a id="s-testing"></a>App testing requirements for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- <a id="s-tracks"></a>Open, closed, internal tests: https://support.google.com/googleplay/android-developer/answer/9845334
- <a id="s-signing"></a>Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- <a id="s-datasafety"></a>Data safety section: https://support.google.com/googleplay/android-developer/answer/10787469
- <a id="s-deletion"></a>Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- <a id="s-userdata"></a>User Data policy (privacy policy): https://support.google.com/googleplay/android-developer/answer/10144311
- <a id="s-ratings"></a>Content ratings: https://support.google.com/googleplay/android-developer/answer/9898843
- <a id="s-questionnaire"></a>Content rating questionnaire: https://support.google.com/googleplay/android-developer/answer/188189
- <a id="s-ratings-users"></a>Content ratings (user-facing tier descriptions): https://support.google.com/googleplay/answer/6209544
- <a id="s-audience"></a>Target audience and content: https://support.google.com/googleplay/android-developer/answer/9867159
- <a id="s-ugc"></a>User Generated Content: https://support.google.com/googleplay/android-developer/answer/9876937
- <a id="s-spam"></a>Spam (Webviews and Affiliate Spam): https://support.google.com/googleplay/android-developer/answer/9899034
- <a id="s-minfunc"></a>Minimum functionality: https://support.google.com/googleplay/android-developer/answer/9898783
- <a id="s-fin"></a>Financial Services: https://support.google.com/googleplay/android-developer/answer/9876821
- <a id="s-assets"></a>Graphic assets, screenshots, video: https://support.google.com/googleplay/android-developer/answer/9866151

**Android developer docs**
- <a id="s-target"></a>Target API level requirements: https://developer.android.com/google/play/requirements/target-sdk
- <a id="s-aab"></a>Android App Bundles: https://developer.android.com/guide/app-bundle
- <a id="s-16kb"></a>16 KB page sizes: https://developer.android.com/guide/practices/page-sizes
- <a id="s-assetlinks"></a>Configure assetlinks.json: https://developer.android.com/training/app-links/configure-assetlinks
- <a id="s-twa-android"></a>Trusted Web Activities overview: https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities

**Chrome / web.dev**
- <a id="s-twa-chrome"></a>TWA overview: https://developer.chrome.com/docs/android/trusted-web-activity
- TWA quick start: https://developer.chrome.com/docs/android/trusted-web-activity/quick-start
- <a id="s-integration"></a>TWA integration guide: https://developer.chrome.com/docs/android/trusted-web-activity/integration-guide
- <a id="s-whatsnew"></a>What's new for Web in Play (2020-12-02): https://developer.chrome.com/docs/android/trusted-web-activity/whats-new
- <a id="s-install"></a>Install criteria: https://web.dev/articles/install-criteria

**Tooling**
- <a id="s-bw"></a>Bubblewrap repo: https://github.com/GoogleChromeLabs/bubblewrap
- <a id="s-bw-cli"></a>Bubblewrap CLI README: https://raw.githubusercontent.com/GoogleChromeLabs/bubblewrap/main/packages/cli/README.md
- <a id="s-bw-gradle"></a>Bubblewrap template `build.gradle` (compile/target SDK 36): https://raw.githubusercontent.com/GoogleChromeLabs/bubblewrap/main/packages/core/template_project/app/build.gradle
- `npm view @bubblewrap/cli`: version 1.27.0, registry modified 2026-10-09
- <a id="s-cap-config"></a>Capacitor config (`server.url`, `webDir`): https://capacitorjs.com/docs/config

**Google Identity**
- <a id="s-oauth"></a>OAuth 2.0 policies (embedded user-agents): https://developers.google.com/identity/protocols/oauth2/policies
