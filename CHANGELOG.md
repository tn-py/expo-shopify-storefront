# Changelog

All notable changes to this template are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this
project doesn't follow semantic versioning in the usual sense (it's a
template, generated into new repositories), so entries are grouped by launch
milestone instead of a release number.

## [Unreleased] — launch-readiness pass

A platform-and-feature audit against Expo SDK 57 and the current Shopify
mobile platform (see [docs/launch-readiness-plan.md](docs/launch-readiness-plan.md)),
followed by the work to close the gaps it found.

### Added

- **Demo mode** — with no store configured, the app runs against
  [mock.shop](https://mock.shop) instead of a setup wall, so the template can
  be tried in about two minutes with zero Shopify credentials. Includes a
  dismissible in-app banner linking to the setup guide.
- **`npm run check:env`** — validates `.env` (domain format, token presence,
  API version freshness) and pings the Storefront API, reporting a bad
  token/domain distinctly from a network problem.
- **Maestro E2E smoke flows** (`.maestro/`) — browse-to-cart and search,
  designed to run against demo mode with zero setup.
- **Authenticated checkout** — a signed-in customer's Customer Account API
  token is attached to the cart's buyer identity, so Checkout opens
  **logged in** with vaulted cards, store credit, and saved addresses,
  instead of a guest checkout.
- **Discount codes** — apply/remove UI in the cart, with allocations shown.
- **Cart warnings** — non-blocking `warnings` from cart mutations are now
  surfaced to the shopper instead of discarded.
- **Accelerated checkout** *(opt-in, iOS 16+)* — Shop Pay / Apple Pay wallet
  buttons on the cart and product page, sharing the regular checkout's
  completion handling.
- **Wishlist / Saved items** — local, on-device wishlist with a heart toggle
  on product cards and the PDP, and a dedicated Saved screen.
- **Recent searches** — the last 8 distinct submitted queries, shown as chips
  on the Search tab's idle state.
- **Product recommendations rail** on the PDP (`productRecommendations`).
- **PDP polish** — instant product cards (prefetch on press-in, seeded from
  card data), a share action, haptics, and stable skeleton loading across
  Home/Shop/Collection/Search/PDP.
- **Markets / localization** — `@inContext(country, language)` threaded
  through every catalog and cart query, derived from the device locale
  (`expo-localization`) with `.env` overrides; money now formats with the
  device's own locale instead of hard-coded `en-US`.
- **Crash reporting** — optional `@sentry/react-native`, off until
  `EXPO_PUBLIC_SENTRY_DSN` is set; `sendDefaultPii` always off.
- **OTA updates** — `expo-updates` with the `fingerprint` runtime-version
  policy, active once the project is linked to EAS (`EAS_PROJECT_ID`).
- React Query's React Native focus/online managers, so queries correctly
  refetch on app foreground and network reconnect.
- `expo-haptics`, `expo-network` as direct dependencies for the above.
- `docs/architecture.md`, `docs/customization.md`, `SECURITY.md`, this
  changelog, and `docs/launch-readiness-plan.md`.

### Changed

- **Sign-out privacy** — signing out now rebuilds a fresh **guest** cart with
  the same line items (instead of leaving the previous customer's identity on
  a shared device's cart), and makes a best-effort call to end the Shopify
  Customer Account API session. If the guest-cart rebuild itself fails (e.g.
  offline), the local cart is cleared instead of risking a leaked identity.
- **Analytics identity** — PostHog now identifies people by their stable
  Shopify **customer GID**, never their email (the email is only ever
  attached as a person property).
- Cart queries no longer request the deprecated `CartCost.totalTaxAmount`
  field; tax-related copy was updated to match.
- The root error boundary now renders inside the HeroUI provider, so it gets
  consistent theming instead of an unstyled fallback.

### Removed

- Unused dependencies and Expo config plugins that added native weight
  without being used: `@expo/ui`, `expo-glass-effect`, `expo-symbols`,
  `expo-device`, `expo-application`, `expo-tracking-transparency` (and the
  Android `AD_ID` permission it implied), and the standalone
  `expo-notifications` plugin registration (OneSignal owns push delivery).
- create-expo-app leftovers and dead code: `themed-text`, `themed-view`,
  the `components/product-card.tsx` re-export, `scripts/reset-project.js`,
  and internal agent-only artifacts (`.superpowers/`, `docs/superpowers/`).

### Fixed

- Normalized mock.shop's raw GraphQL `errors` array shape to match
  `@shopify/storefront-api-client`'s `{ message }` shape, so demo-mode error
  handling behaves the same as against a real store.
- The wishlist heart icon's backdrop is now theme-aware, so it stays legible
  in dark mode instead of blending into dark product imagery.

### Security

- A signed-in customer's access token is never stored in, or derived
  reversibly from, cart synchronization state: `buyerIdentityKey()` uses a
  one-way FNV-1a fingerprint of the token, not the token itself, to detect
  rotation.
- `ITSAppUsesNonExemptEncryption: false` is now set explicitly (the app only
  ever speaks HTTPS), removing the App Store Connect export-compliance prompt
  on every upload.

## [0.x] – pre-release

The commerce foundation this launch-readiness pass builds on: HeroUI
Native-based UI redesign; native storefront browsing, search, and collection
grid against the Storefront API; cart with a concurrency-safe snapshot
sequencer, per-line quantity queue, and persistence coordinator; native
checkout via `@shopify/checkout-sheet-kit`; optional Customer Account API
accounts (OAuth + PKCE) with orders, shipment tracking, and view-only
addresses; deep links and storefront-URL rewriting; optional PostHog
analytics and OneSignal push; CI (`typecheck`, `lint`, Jest, `expo-doctor`) on
every push and PR.
