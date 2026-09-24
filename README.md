# Expo Shopify Storefront

[![CI](https://github.com/tn-py/expo-shopify-storefront/actions/workflows/ci.yml/badge.svg)](https://github.com/tn-py/expo-shopify-storefront/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Expo SDK 57](https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white)](https://docs.expo.dev/versions/v57.0.0/)
[![React Native 0.86](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![Use this template](https://img.shields.io/badge/GitHub-Use%20this%20template-2ea44f?logo=github)](https://github.com/tn-py/expo-shopify-storefront/generate)

A production-shaped **Expo template** for a native iOS + Android storefront on top
of any Shopify store. Browsing, search, and cart are rendered natively from the
**Storefront API**; checkout is handed to Shopify's own **Checkout Sheet Kit**, so
payments, taxes, discounts, and checkout extensions all stay on Shopify.

Everything merchant-specific — name, colours, bundle id, deep-link domains, store
credentials — is configuration, not code. Try it against Shopify's public demo
catalog with zero setup, then point it at your own store when you're ready.

## Try it in 2 minutes

No Shopify store needed yet — with no credentials configured, the app runs
against [mock.shop](https://mock.shop), Shopify's public sample catalog (see
[demo-mode.md](docs/demo-mode.md)).

```sh
npx degit tn-py/expo-shopify-storefront my-store
cd my-store
npm install
```

> Alternatively: `npx create-expo-app@latest my-store --template https://github.com/tn-py/expo-shopify-storefront`.
> Both give you the same source tree; `degit` is smaller and faster since it
> only copies files (no git history), and is the path this README assumes.

```sh
npm install -g eas-cli && eas login
eas build --profile development --platform android   # one-time dev client (sideloadable APK)
npm start                                             # expo start --dev-client
```

> Requires **Node 22 LTS** and an [Expo / EAS account](https://expo.dev). The
> Checkout Sheet Kit is a native module, so **Expo Go won't work** — you need a
> dev client, even to try demo mode. Swap `android` for `ios` /
> `development-simulator` to build for iOS instead (see
> [Building & releasing](#building--releasing)).

Open the dev client on the device/simulator and connect to Metro. You now have a
working storefront with sample products, collections, cart, and checkout — a
small dismissible banner reminds you it's a demo.

### Connect your store

```sh
cp .env.example .env
```

Fill in at minimum:

| Variable | Where to get it |
| --- | --- |
| `EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN` | Your permanent `*.myshopify.com` domain |
| `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | Storefront API access token — see [shopify-setup.md](docs/shopify-setup.md) |

```sh
npm run check:env      # validates .env and pings the Storefront API with your token
```

Restart Metro with `--clear` after editing `.env`. Once a real store domain +
token are set, demo mode has no effect — the app always talks to your store.

## Features

### Storefront

- Home — brand logo/name pulled from Shopify, and configurable sections (hero
  banner, featured collections, featured products, trust badges) defined in
  [`src/config/storefront-ui.ts`](src/config/storefront-ui.ts).
- Shop, predictive Search (with recent-search chips), Collection grid with sort,
  filters, and infinite scroll.
- Product detail — image carousel, variant picker, product recommendations
  rail, share action, and haptics; product cards prefetch on press-in for an
  instant-feeling PDP.

### Cart & checkout

- Storefront Cart API, quantity steppers, tab badge, persisted across launches.
  Cart mutations are concurrency-safe (a snapshot sequencer, a per-line
  quantity queue, and a persistence coordinator serialize competing updates —
  see [architecture.md](docs/architecture.md)).
- Native checkout via `@shopify/checkout-sheet-kit`, preloaded for a fast
  presentation; the `completed` event clears the cart and routes to an
  order-confirmed screen.
- **Authenticated checkout** — a signed-in customer's cart carries their
  Customer Account API token as buyer identity, so Checkout opens **logged
  in**, with **vaulted cards, store credit, and saved addresses** — see
  [customer-accounts.md](docs/customer-accounts.md#authenticated-checkout).
- Discount codes (apply/remove, allocations shown) and non-blocking cart
  **warnings** surfaced from Shopify's cart mutations.
- **Accelerated checkout** *(optional, iOS 16+)* — Shop Pay / Apple Pay wallet
  buttons on the cart and PDP for a one-tap purchase — see
  [accelerated-checkout.md](docs/accelerated-checkout.md).
- Signing out rebuilds a fresh **guest** cart (privacy on shared devices) and
  makes a best-effort call to end the Shopify session.

### Accounts *(optional)*

- Customer Account API OAuth 2.0 + PKCE, tokens in `expo-secure-store`, silent
  refresh, session-isolated caches.
- Paginated Orders with shipment/tracking detail, and view-only Addresses with
  a configured hosted-management handoff. See
  [customer-accounts.md](docs/customer-accounts.md).

### Wishlist & recent searches

- Local wishlist ("Saved items") — heart toggle on product cards and the PDP,
  a dedicated Saved screen, persisted on-device (no account required).
- Recent searches shown as chips on the Search tab's idle state.

### Markets & localization

- Shopify's `@inContext(country, language)` directive localizes prices,
  availability, and translated content on every catalog and cart query,
  derived from the device's locale (`expo-localization`) with `.env`
  overrides.
- Money is formatted with `Intl.NumberFormat` using the device's locale, not
  hard-coded to `en-US`.

### Deep links

- Custom URL scheme (`EXPO_PUBLIC_APP_SCHEME`) works out of the box.
- Storefront-shaped `https://` paths (`/products/…`, `/collections/…`,
  `/search`) are rewritten to the matching app route.
- Universal Links / App Links *(optional)* — ready as soon as you set
  `EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS` and host two well-known files. See
  [deep-links.md](docs/deep-links.md).

### Push notifications — OneSignal *(optional, off until configured)*

Signed-in shoppers are linked to their Shopify customer id; notification taps
deep-link to the right screen. No-ops with no App ID. See
[push-notifications.md](docs/push-notifications.md).

### Analytics — PostHog *(optional, off until configured)*

Wraps `product_viewed`, `search`, `add_to_cart`, `purchase`, `login`,
wishlist, and checkout-recovery events. Identifies people by their stable
Shopify customer GID, never their email. No-ops with no key.

### Crash reporting — Sentry *(optional, off until configured)*

`@sentry/react-native`, wired through [`src/lib/monitoring.ts`](src/lib/monitoring.ts):
captures the root error boundary and exposes `captureException`. Adds its Expo
config plugin only when `EXPO_PUBLIC_SENTRY_DSN` is set; `sendDefaultPii` is
always off. No-ops with no DSN.

### OTA updates *(optional, on once the project is linked to EAS)*

`expo-updates` with the `fingerprint` runtime-version policy, so a JS-only
change ships without a native rebuild or a manual version bump. Only active
once `EAS_PROJECT_ID` is set (`eas init`). See
[Building & releasing](#building--releasing).

### Demo mode

With no store configured, the app runs against `mock.shop` instead of showing
a setup wall — the whole point of [Try it in 2 minutes](#try-it-in-2-minutes).
See [demo-mode.md](docs/demo-mode.md).

### DX

TypeScript strict, Expo Router typed routes, React Compiler, React Query (with
the React Native focus/online managers wired up), ESLint, `expo-doctor`,
`npm run check:env`, `npm run verify`, Maestro E2E smoke flows, and CI on every
push/PR.

## Screenshots

<!-- Screenshots coming soon — see docs/media/README.md for the shot list and
     naming convention. Once added, reference them here, e.g.:
     | Home | Product | Cart |
     | --- | --- | --- |
     | ![Home](docs/media/home.png) | ![Product](docs/media/product.png) | ![Cart](docs/media/cart.png) |
-->

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19.2 |
| Navigation | Expo Router 57 (typed routes, `src/app/`) |
| Shopify catalog/cart | `@shopify/storefront-api-client` (GraphQL, `2026-07`) |
| Checkout | `@shopify/checkout-sheet-kit` 3.9 ("Checkout Kit") |
| Accounts | Shopify Customer Account API + `expo-auth-session` (PKCE) |
| Server state | `@tanstack/react-query` |
| UI | HeroUI Native + Uniwind, consumed through app-owned commerce/ui primitives |
| Storage | `@react-native-async-storage/async-storage`, `expo-secure-store` |
| Analytics | `posthog-react-native` (optional) |
| Push | `react-native-onesignal` + `onesignal-expo-plugin` (optional) |
| Crash reporting | `@sentry/react-native` (optional) |
| OTA updates | `expo-updates`, fingerprint runtime version |
| Builds | EAS Build (iOS + Android) |

## Configuration

`EXPO_PUBLIC_*` values are inlined into the JS bundle at build time — that's
safe: the Storefront API token and Customer Account API client id are
**public** credentials by design (see [SECURITY.md](SECURITY.md)). The
complete, commented reference is [`.env.example`](.env.example); the tables
below mirror its sections.

#### Shopify Storefront API — required

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN` | Your `*.myshopify.com` domain | *(unset → demo mode)* |
| `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | Storefront API public access token | *(unset → demo mode)* |
| `EXPO_PUBLIC_SHOPIFY_API_VERSION` | Storefront + Customer Account API version | `2026-07` |

#### Demo mode

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_DEMO_MODE` | `on` runs against mock.shop when no store is configured; `off` shows the setup wall instead | `on` |

#### Customer Account API — optional

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` | Enables sign-in / orders / addresses | *(off)* |
| `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL` | Shop-specific auth base URL | *(off)* |
| `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_MANAGE_URL` | Hosted address-management handoff | *(off, hides the action)* |

#### App identity — native build-time

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_APP_NAME` | Display name | `Shopify Storefront` |
| `EXPO_PUBLIC_APP_SLUG` | EAS slug | `expo-shopify-storefront` |
| `EXPO_PUBLIC_APP_SCHEME` | Deep-link scheme (`scheme://product/x`) | `shopstore` |
| `EXPO_PUBLIC_APP_BUNDLE_ID` | iOS bundle id + Android package | `com.example.storefront` |
| `EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS` | Comma list of `https://` App Link hosts | *(off)* |

#### Branding

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_BRAND_PRIMARY` | Buttons, links, active tab, notification colour | `#0a7ea4` |
| `EXPO_PUBLIC_BRAND_ON_PRIMARY` | Foreground on top of the primary accent | `#ffffff` |
| `EXPO_PUBLIC_BRAND_SALE` | Sale price + cart badge | `#d1453b` |
| `EXPO_PUBLIC_APP_BACKGROUND` | Splash + Android adaptive-icon background | `#ffffff` |
| `EXPO_PUBLIC_APP_COLOR_SCHEME` | `light` \| `dark` \| `system` | `system` |

#### Account screen links — optional

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | Support mailto link on Account | *(hidden)* |
| `EXPO_PUBLIC_ABOUT_URL` | About link on Account | *(hidden)* |

#### Markets / localization — optional

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_SHOPIFY_COUNTRY` | ISO 3166-1 alpha-2 override, e.g. `GB` | *(device region)* |
| `EXPO_PUBLIC_SHOPIFY_LANGUAGE` | Shopify `LanguageCode` override, e.g. `FR` | *(device language)* |
| `EXPO_PUBLIC_SHOPIFY_LOCALIZE` | `device` follows the locale above; `off` skips `@inContext` entirely | `device` |

#### Analytics — PostHog — optional

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_POSTHOG_KEY` | Project API key | *(off, no-ops)* |
| `EXPO_PUBLIC_POSTHOG_HOST` | PostHog host | `https://us.i.posthog.com` |

#### Push notifications — OneSignal — optional

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_ONESIGNAL_APP_ID` | OneSignal App ID | *(off, no-ops)* |
| `EXPO_PUBLIC_ONESIGNAL_IOS_MODE` | iOS APNs environment baked into the build | `development` |

#### Crash reporting — Sentry — optional

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN | *(off, no-ops)* |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Org/project slugs for source-map upload (build-time only, not inlined) | *(unset)* |

`SENTRY_AUTH_TOKEN` (source-map upload) is never put in `.env` — set it as an
EAS secret: `eas secret:create --name SENTRY_AUTH_TOKEN`.

#### Accelerated checkout — optional, iOS 16+

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_SHOPIFY_ACCELERATED_CHECKOUT` | `true` enables Shop Pay / Apple Pay wallet buttons | *(off)* |
| `EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID` | Apple merchant id — Apple Pay only offered when set | *(off, Shop Pay only)* |

#### EAS — optional, build-time only

| Variable | Purpose | Default |
| --- | --- | --- |
| `EAS_PROJECT_ID` | Links the project to EAS; also turns on OTA updates | *(unset by `eas init`)* |
| `EAS_OWNER` | EAS account/org that owns the project | *(unset)* |

## Project structure

```
app.config.ts             Native config, fully driven by .env
src/
  app/                     Expo Router routes (screens/layouts only — see AGENTS.md)
    (tabs)/                Home · Shop · Search · Cart · Account
    account/                orders · order/[id] · addresses
    product/[handle].tsx    PDP — carousel, variant picker, recommendations, share
    collection/[handle].tsx grid · sort · filters · infinite scroll
    saved.tsx               wishlist grid
    setup.tsx                "connect your store" guide (demo-mode banner target)
    order-confirmed.tsx     post-checkout screen
    _layout.tsx             provider tree — see docs/architecture.md
    +native-intent.ts       storefront URL → app route rewriting
  shopify/
    client.ts                Storefront API client + storefront() helper (+ mock.shop demo transport)
    queries.ts                GraphQL operations
    hooks.ts                  React Query hooks (shop, collections, product, search, recommendations, wishlist refresh)
    locale.ts                 @inContext country/language, device-locale money formatting
    cart.tsx / cart-operations.ts   CartProvider / useCart, concurrency primitives
    checkout.tsx / checkout-state.ts   Checkout Sheet events + useCheckout()
    accelerated-checkout-config.ts   Shop Pay / Apple Pay wallet-button config sync
    auth.tsx                  Customer Account API OAuth (PKCE)
    customer.ts / customer-session.ts   orders / order / addresses queries + hooks
    product-loader.ts, order-presentation.ts   loaders/presenters kept out of hooks.ts
    env.ts / types.ts
  wishlist/                 local wishlist store + WishlistProvider/useWishlist
  components/
    commerce/                ProductCard, CollectionCard, recommendations rail, wishlist button, accelerated-checkout UI, skeletons
    ui/                       app-owned design-system primitives (buttons, fields, price, toasts, …)
  notifications/             OneSignal push: init, identity sync, deep-linked taps
  lib/                       analytics · monitoring (Sentry) · format (money) · deep-link · haptics · query-client/query-lifecycle · recent-searches
  theme/                     initialize-theme.ts — pushes brand colours into Uniwind's CSS vars
  config/                    storefront-ui.ts (Home sections, PDP service disclosures) · account-links.ts
  constants/theme.ts         Design tokens (colours from .env)
  hooks/                     theme resolution, pagination-lock helper
scripts/                     check-env.mjs · env-rules.cjs (validation rules, Jest-tested)
.maestro/                    E2E smoke flows (search, browse) — run against demo mode
docs/                        architecture · customization · shopify-setup · customer-accounts ·
                              deep-links · push-notifications · accelerated-checkout · demo-mode ·
                              e2e · manual-qa · launch-readiness-plan · well-known/ · media/
```

## Guides

- [Architecture](docs/architecture.md) — provider tree, data flow, cart state
  machine, checkout flow, auth, optional-integrations pattern.
- [Customization](docs/customization.md) — branding, fonts, Home sections, PDP
  disclosures, adding a screen/query, turning features on/off, removing an
  integration.
- [Shopify setup](docs/shopify-setup.md) — API token, scopes, publication,
  checkout test mode.
- [Customer accounts](docs/customer-accounts.md) — Customer Account API,
  authenticated checkout, sign-out privacy.
- [Deep links & universal links](docs/deep-links.md) — schemes, App Links,
  `.well-known` files.
- [Push notifications](docs/push-notifications.md) — OneSignal setup,
  identity, deep-linked taps.
- [Accelerated checkout](docs/accelerated-checkout.md) — Shop Pay / Apple Pay
  wallet buttons.
- [Demo mode](docs/demo-mode.md) — how the mock.shop fallback works.
- [E2E smoke tests](docs/e2e.md) — Maestro flows.
- [Manual QA](docs/manual-qa.md) — iOS/Android visual, commerce, privacy, and
  accessibility checklist.

## Building & releasing

```sh
eas build --profile development --platform android   # sideloadable dev client
eas build --profile development --platform ios        # device dev client, or:
eas build --profile development-simulator --platform ios   # iOS simulator (no Mac needed)

eas build --profile preview --platform all             # internal testing build
eas build --profile production --platform all          # store build
eas submit --profile production --platform ios         # / android
```

Version and build numbers auto-increment on the `production` profile
(`appVersionSource: "remote"` in `eas.json`).

Once `EAS_PROJECT_ID` is set, `production`/`preview`/`development` builds are
wired to matching **OTA update channels** (`eas.json`). Ship a JS-only change
without a store review:

```sh
eas update --branch production --message "…"
```

Before every release, run through [docs/release-checklist.md](docs/release-checklist.md)
(store listing, privacy labels, screenshots).

## Checks

```sh
npm run typecheck        # tsc --noEmit
npm run lint              # expo lint
npm test                  # Jest Expo + React Native Testing Library
npm run doctor             # expo-doctor
npm run check:env          # validates .env and pings the Storefront API
npm run verify              # typecheck && lint && test
npm run e2e                 # Maestro smoke flows against a dev/preview build — see docs/e2e.md
npx expo export --platform android   # full bundle smoke test
npx expo export --platform ios       # full bundle smoke test
```

CI runs typecheck, lint, the Jest suite, and Expo Doctor on every push to
`main` and every PR, plus iOS and Android export smoke tests
(`.github/workflows/ci.yml`). Dependabot keeps dependencies current, and the
repo includes example EAS Workflows for automated builds.

## Roadmap

Explicitly deferred for now — see
[launch-readiness-plan.md](docs/launch-readiness-plan.md#5-explicitly-deferred-roadmap):

- Checkout Kit v4 (`@shopify/checkout-kit`) — adopt when it leaves alpha.
- `NativeTabs` / Liquid Glass tab bar — adopt when stable (Expo SDK 58).
- GraphQL codegen (`@shopify/api-codegen-preset`) to replace hand-written types.
- `selectedOrFirstAvailableVariant` / `encodedVariantAvailability` for
  very-high-variant products.
- Metaobject-driven Home sections, so merchants can edit without a rebuild.
- i18n string catalog. FlashList for very large catalogs.
- Agentic commerce (UCP / Storefront MCP) sample integration.

Beyond that: product reviews and richer collection filters are natural next
additions — PRs welcome.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The goal is a small, readable,
store-agnostic starting point — issues and PRs that keep it that way are
welcome.

## Security

See [SECURITY.md](SECURITY.md) for supported versions and how to report a
vulnerability privately.

## License

[MIT](LICENSE).

## Acknowledgements

Built on [Expo](https://expo.dev) and the
[Shopify Storefront](https://shopify.dev/docs/api/storefront) /
[Checkout Sheet Kit](https://github.com/Shopify/checkout-sheet-kit-react-native) /
[Customer Account](https://shopify.dev/docs/api/customer) APIs, with
[HeroUI Native](https://github.com/heroui-inc/heroui-native) and
[Uniwind](https://github.com/founded-labs/uniwind) for the UI layer.
