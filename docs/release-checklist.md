# Release checklist

A practical, ordered checklist for shipping an app built from this template to the
App Store and Google Play. Most items link to a deeper doc — this page is the
"what, in what order" view.

## 1. Accounts

- [ ] **Apple Developer Program** membership ($99/yr) — required for App Store builds
      and TestFlight, even for internal testing.
- [ ] **Google Play Console** account ($25 one-time) — required for a production or
      internal Play track.
- [ ] **Shopify store** on a plan that includes API access (Storefront API is
      available on all plans, including trial). See [shopify-setup.md](./shopify-setup.md).

## 2. App identity

- [ ] Set `EXPO_PUBLIC_APP_NAME`, `EXPO_PUBLIC_APP_SLUG`, `EXPO_PUBLIC_APP_SCHEME`,
      and `EXPO_PUBLIC_APP_BUNDLE_ID` in `.env` — the bundle id must be unique
      (reverse-DNS, e.g. `com.yourcompany.storefront`) and can't be changed after
      your first store submission.
- [ ] Replace the icon/splash/adaptive-icon assets in `assets/images/` (`icon.png`,
      `splash-icon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`)
      with your own artwork.
- [ ] Set `EXPO_PUBLIC_BRAND_PRIMARY`, `EXPO_PUBLIC_BRAND_ON_PRIMARY`,
      `EXPO_PUBLIC_BRAND_SALE`, and `EXPO_PUBLIC_APP_BACKGROUND` to your brand colours.
- [ ] Run `npm run check:env` — it validates the whole `.env`, not just identity, and
      flags anything still at the template default (e.g. the placeholder bundle id).

## 3. Shopify configuration

- [ ] Storefront API access token with the required scopes (see
      [shopify-setup.md](./shopify-setup.md#1-storefront-api-access-token-required)).
- [ ] Products **published to the sales channel** tied to your Storefront API app —
      *Active* status alone isn't enough (see
      [shopify-setup.md](./shopify-setup.md#2-products-collections--publication)).
- [ ] Customer Account API set up if you want sign-in/orders/addresses, including the
      `shop.<shop-id>.app://callback` redirect URI (`npm run check:env` prints the
      exact URI once the API URL is filled in) — see
      [customer-accounts.md](./customer-accounts.md).
- [ ] If offering accelerated checkout, request the `write_cart_wallet_payments`
      scope from Shopify for your Storefront API app, and (for Apple Pay) an Apple
      merchant id — see [accelerated-checkout.md](./accelerated-checkout.md). This is
      opt-in and off by default.

## 4. EAS

- [ ] `eas init` — links the repo to an EAS project and sets `EAS_PROJECT_ID`
      (`.env` and/or `app.config.ts` extra.eas.projectId). This is also what turns on
      OTA updates (`updates.url`); `runtimeVersion` already uses the `fingerprint`
      policy, so it tracks native changes automatically with no manual bump.
- [ ] Set EAS secrets/environment variables in the
      [EAS dashboard](https://expo.dev) → your project → **Environment variables**,
      scoped per environment (`development` / `preview` / `production` — matching the
      `environment` key on each `eas.json` build profile):
  - Every `EXPO_PUBLIC_*` value from `.env` you want baked into store builds.
  - `SENTRY_AUTH_TOKEN` (secret, not `EXPO_PUBLIC_*`) if using Sentry source-map
    upload — set via `eas secret:create --name SENTRY_AUTH_TOKEN --scope project` or
    the dashboard. `SENTRY_ORG` / `SENTRY_PROJECT` can be plain env vars.
- [ ] Review `eas.json` — profiles, channels, and `submit.production`.
      `submit.production` intentionally has no committed credentials (Apple/Google
      credentials are supplied interactively by `eas submit` or via EAS secrets, not
      as plaintext in `eas.json`, since JSON can't hold comments explaining that).
- [ ] Optional: try the example workflows in `.eas/workflows/` (see
      [ci.md](./ci.md#eas-workflows)) once `eas init` and the EAS GitHub app are set up.

## 5. Builds

- [ ] `eas build --profile development --platform ios|android` — dev-client build for
      local testing (also what Maestro needs, since Expo Go can't load the native
      Checkout Sheet Kit module).
- [ ] `eas build --profile preview --platform ios|android` — internal-distribution
      build close to a store build, for TestFlight/internal-track QA.
- [ ] `eas build --profile production --platform ios --auto-submit` (or without
      `--auto-submit`, then `eas submit` separately) — store build.
      `autoIncrement: true` bumps the build number automatically.

## 6. OTA updates

- [ ] Confirm `EAS_PROJECT_ID` is set (turns on `updates.url` in `app.config.ts`).
- [ ] Understand the channel → profile mapping in `eas.json`
      (`development` / `preview` / `production` channels, one per build profile).
- [ ] Ship a JS/asset-only fix with `eas update --channel production --message
      "<what changed>"` — it only reaches builds whose native fingerprint matches
      (see `runtimeVersion: { policy: "fingerprint" }` in `app.config.ts`); a change
      to native config or a native dependency needs a new build, not an update.

## 7. Store listing

- [ ] Screenshots for every required device size (iPhone 6.7"/6.5", iPad if
      `supportsTablet` stays true; Android phone + 7"/10" tablet if you support
      tablets). Save source screenshots under `assets/media/` or similar for reuse.
- [ ] Privacy policy URL (required by both stores if you collect *any* data — see
      the data-collection list below).
- [ ] Apple **App Privacy** ("nutrition label") and Google Play **Data safety** form.
      This template collects **nothing by default**. Fill in the forms based on what
      you've actually configured:
  - **PostHog** (`EXPO_PUBLIC_POSTHOG_KEY` set): product usage/analytics events,
    device identifiers, approximate location (IP-derived) if not disabled in your
    PostHog project settings.
  - **OneSignal** (`EXPO_PUBLIC_ONESIGNAL_APP_ID` set): push tokens/device
    identifiers, used for notification delivery.
  - **Sentry** (`EXPO_PUBLIC_SENTRY_DSN` set): crash/error diagnostics, which can
    include device identifiers and stack traces. `sendDefaultPii` is off (see
    `src/lib/monitoring.ts`), so user-identifying data isn't sent by default.
  - **Shopify Customer Account API** (customer sign-in configured): account
    identity, order history, and address data flow through Shopify directly — this
    template doesn't store it separately, but declare it per the stores' rules for
    apps that support sign-in.
  - If none of the above are configured, the app makes only unauthenticated
    Storefront API requests (or talks to mock.shop in demo mode) and stores nothing
    server-side.
- [ ] Export compliance — already handled:
      `infoPlist.ITSAppUsesNonExemptEncryption: false` in `app.config.ts` skips the
      per-upload prompt (the app only ever makes standard HTTPS requests).

## 8. Testing

- [ ] `npm run verify` (typecheck + lint + tests) is green.
- [ ] Maestro smoke flows pass against a dev/preview build — see
      [e2e.md](./e2e.md) and `.maestro/`.
- [ ] Manual QA pass on both platforms — see [manual-qa.md](./manual-qa.md).

## 9. Submission

- [ ] `eas submit --platform ios --profile production` (App Store Connect —
      TestFlight review, then submit for App Review).
- [ ] `eas submit --platform android --profile production` (Google Play — start on
      an internal or closed track before promoting to production).

## 10. Post-launch

- [ ] Watch Sentry (if configured) for the first 24–48h after each release.
- [ ] Watch PostHog (if configured) for conversion/funnel drop-offs.
- [ ] OTA hotfix process: `eas update --channel production` for JS/asset-only fixes;
      a new `eas build` for anything native.
- [ ] SDK upgrades: `npx expo install --fix` after bumping `expo` in `package.json`
      (see [ci.md](./ci.md#dependabot) — Dependabot intentionally ignores major
      version bumps for Expo-managed packages, so these are always a deliberate,
      manual step), then `npx expo-doctor`, `npm run verify`, and a full rebuild.

---

## Launching this template repo publicly

For the maintainer, once the checks above are green on `main`:

- [ ] Make the repository **public**.
- [ ] Enable **"Template repository"** (Settings → General → Template repository) so
      "Use this template" appears for people cloning it.
- [ ] Add repo **topics** (e.g. `expo`, `react-native`, `shopify`, `storefront-api`,
      `ecommerce`, `template`, `expo-router`).
- [ ] Enable **Discussions**.
- [ ] Enable **private vulnerability reporting** (Settings → Security → Private
      vulnerability reporting) — see [SECURITY.md](../SECURITY.md).
- [ ] Add screenshots/a demo GIF (`docs/media/`) to the README.
- [ ] Cut a **v1.0.0** release/tag once the above is done.
