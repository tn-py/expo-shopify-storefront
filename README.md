# Expo Shopify Storefront

A production-shaped **Expo template** for a native iOS + Android storefront on top
of any Shopify store. Browsing, search and cart are rendered natively from the
**Storefront API**; checkout is handed to Shopify's own **Checkout Sheet Kit**, so
payments, taxes, discounts and checkout extensions all stay on Shopify.

Clone it, fill in `.env`, build once, and you have a working store app. Everything
merchant-specific — name, colours, bundle id, deep-link domains, store
credentials — is configuration, not code.

```sh
npx degit tn-py/expo-shopify-storefront my-store-app
cd my-store-app
npm install
cp .env.example .env      # add your Shopify domain + Storefront API token
npm start
```

> Requires **Node 22 LTS** and an [Expo / EAS account](https://expo.dev). The
> Checkout Sheet Kit is a native module, so **Expo Go won't work** — you need a
> dev client (one `eas build`, below).

---

## Features

- **Native storefront** — Home (collections + store logo), Shop, predictive
  Search, Collection grid with sort + infinite scroll, Product detail with an
  image carousel and variant picker.
- **Cart** — Storefront Cart API, quantity steppers, tab badge, persisted across
  launches (`AsyncStorage`).
- **Native checkout** — `@shopify/checkout-sheet-kit` with preloading; `completed`
  event clears the cart and routes to an order-confirmed screen.
- **Customer accounts** *(optional)* — Customer Account API OAuth 2.0 + PKCE,
  tokens in `expo-secure-store`, silent refresh; Orders, Order detail and
  Addresses screens.
- **Deep links** — custom scheme out of the box; storefront `https://` links
  (`/products/…`, `/collections/…`, `/search`) rewritten to app routes; App Links
  / Universal Links ready when you add your domain.
- **Analytics** *(optional)* — PostHog wrapper; `product_viewed`, `search`,
  `add_to_cart`, `purchase`, `login`. No-ops with no key.
- **Theming** — light / dark / system, accent colours from `.env`, Montserrat
  type scale, shared design tokens.
- **DX** — TypeScript strict, Expo Router typed routes, React Compiler,
  React Query, ESLint, `expo-doctor`, CI workflow.

## Screenshots

_Add screenshots to `docs/media/` and link them here (see `docs/media/README.md`)._

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Navigation | Expo Router 57 (typed routes, `src/app/`) |
| Shopify catalog/cart | `@shopify/storefront-api-client` (GraphQL, `2026-07`) |
| Checkout | `@shopify/checkout-sheet-kit` |
| Accounts | Shopify Customer Account API + `expo-auth-session` (PKCE) |
| Server state | `@tanstack/react-query` |
| Storage | `@react-native-async-storage/async-storage`, `expo-secure-store` |
| Analytics | `posthog-react-native` (optional) |
| Builds | EAS Build (iOS + Android) |

## Getting started

### 1. Prerequisites

- **Node 22 LTS** (`node -v` → `v22.x`). If your system Node is newer, use
  [`fnm`](https://github.com/Schniz/fnm) or `nvm`; `.node-version` pins `22`.
- `npm install -g eas-cli` and `eas login`.

### 2. Configure

```sh
cp .env.example .env
```

Fill in at minimum:

| Variable | Where to get it |
| --- | --- |
| `EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN` | Your permanent `*.myshopify.com` domain |
| `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | Storefront API access token — see [`docs/shopify-setup.md`](docs/shopify-setup.md) |

Until those are set the app shows a short setup screen instead of the storefront.
Full variable reference is in [`.env.example`](.env.example); the highlights:

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_APP_NAME` / `_SLUG` | Display name / EAS slug | `Shopify Storefront` / `expo-shopify-storefront` |
| `EXPO_PUBLIC_APP_SCHEME` | Deep-link scheme (`scheme://product/x`) | `shopstore` |
| `EXPO_PUBLIC_APP_BUNDLE_ID` | iOS bundle id + Android package | `com.example.storefront` |
| `EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS` | Hosts for `https://` App Links (comma list) | *(off)* |
| `EXPO_PUBLIC_BRAND_PRIMARY` / `_ON_PRIMARY` / `_SALE` | Accent colours | `#0a7ea4` / `#fff` / `#d1453b` |
| `EXPO_PUBLIC_APP_COLOR_SCHEME` | `light` \| `dark` \| `system` | `system` |
| `EXPO_PUBLIC_APP_BACKGROUND` | Splash + adaptive-icon background | `#ffffff` |
| `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` / `_API_URL` | Enable customer accounts | *(off)* |
| `EXPO_PUBLIC_SUPPORT_EMAIL` / `EXPO_PUBLIC_ABOUT_URL` | Account-screen links | *(hidden)* |
| `EXPO_PUBLIC_POSTHOG_KEY` / `_HOST` | Analytics | *(off)* |

`EXPO_PUBLIC_*` values are inlined into the JS bundle. The Storefront API token
and Customer Account client id are **public** credentials — that's expected and
safe. Restart Metro with `--clear` after editing `.env`.

### 3. Build a dev client (one time per platform)

```sh
eas init                                             # links / creates the EAS project
eas build --profile development --platform android   # sideloadable APK
eas build --profile development --platform ios       # device, or:
eas build --profile development-simulator --platform ios   # iOS simulator (no Mac needed)
```

### 4. Run

```sh
npm start          # expo start --dev-client
```

Open the dev client on the device/simulator and connect to Metro.

## Project structure

```
app.config.ts            Native config, fully driven by .env
src/
  app/                    Expo Router routes
    _layout.tsx           Providers: QueryClient · CheckoutSheet · Auth · Cart · theme · Stack
    (tabs)/               Home · Shop · Search · Cart · Account
    product/[handle].tsx  PDP — carousel, variant picker, add to cart
    collection/[handle].tsx  grid · sort · infinite scroll
    account/              orders · order/[id] · addresses
    order-confirmed.tsx   post-checkout screen
    +native-intent.ts     storefront URL → app route rewriting
  shopify/
    client.ts             Storefront API client + storefront() helper
    queries.ts            GraphQL operations
    hooks.ts              React Query hooks (shop, collections, product, search)
    cart.tsx              CartProvider / useCart
    checkout.tsx          Checkout Sheet events + useCheckout()
    auth.tsx              Customer Account API OAuth (PKCE)
    customer.ts           orders / order / addresses queries + hooks
    env.ts / types.ts
  components/             ProductCard · ScreenState · SetupRequired · themed primitives
  constants/theme.ts      Design tokens (colours from .env)
  hooks/ · lib/           theme resolution · analytics · formatting · query client
docs/                     shopify-setup · deep-links · customer-accounts · well-known/
```

## Guides

- [Shopify setup](docs/shopify-setup.md) — API token, scopes, publication, checkout test mode
- [Customer accounts](docs/customer-accounts.md) — Customer Account API + callback URI
- [Deep links & universal links](docs/deep-links.md) — schemes, App Links, `.well-known` files

## Building for release

```sh
eas build --profile preview --platform all       # internal testing build
eas build --profile production --platform all     # store build
eas submit --profile production --platform ios    # / android
```

Version and build numbers auto-increment on the `production` profile
(`appVersionSource: "remote"` in `eas.json`).

## Checks

```sh
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
npm run doctor           # expo-doctor
npx expo export --platform android   # full bundle smoke test
```

CI runs the first three on every push and PR (`.github/workflows/ci.yml`).

## Roadmap

- Push notifications (`expo-notifications` device registration + a Shopify webhook
  → Expo Push API sender). The plugin is configured; registration/sender aren't
  built.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The goal is a small, readable,
store-agnostic starting point — issues and PRs that keep it that way are welcome.

## License

[MIT](LICENSE).

## Acknowledgements

Built on [Expo](https://expo.dev) and the
[Shopify Storefront](https://shopify.dev/docs/api/storefront) /
[Checkout Sheet Kit](https://github.com/Shopify/checkout-sheet-kit-react-native) /
[Customer Account](https://shopify.dev/docs/api/customer) APIs.
