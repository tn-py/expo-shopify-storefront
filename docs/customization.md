# Customization

How to make this template look and behave like your store, without forking
its architecture. See [architecture.md](architecture.md) for how the pieces
fit together.

## Branding (colours)

Set the brand env vars and restart Metro with `--clear`:

```sh
EXPO_PUBLIC_BRAND_PRIMARY=#111827
EXPO_PUBLIC_BRAND_ON_PRIMARY=#ffffff
EXPO_PUBLIC_BRAND_SALE=#b91c1c
```

These flow two ways, both from `src/constants/theme.ts`'s `Brand` object:

- **Native/JS colours** — `Colors.light.primary` / `Colors.dark.primary` (used
  by React Navigation's theme, the status bar, icons, etc.) read `Brand`
  directly.
- **Uniwind CSS variables** — `src/theme/initialize-theme.ts` calls
  `Uniwind.updateCSSVariables('light' | 'dark', { '--accent': Brand.primary,
  '--accent-foreground': Brand.onPrimary, '--danger': Brand.sale, '--sale':
  Brand.sale })` once at startup, overriding the fallback values hard-coded in
  [`global.css`](../global.css) (`--accent: #0a7ea4`, etc. — those exist only
  so styles resolve before JS runs; the env value always wins at runtime).

`EXPO_PUBLIC_APP_BACKGROUND` (splash + Android adaptive-icon background) and
`EXPO_PUBLIC_APP_COLOR_SCHEME` (`light` | `dark` | `system`) are native
build-time values — changing them needs a new dev-client build. Everything
else in this section is a Metro restart.

## Fonts

Typography currently uses each platform's **system font** (`src/constants/theme.ts`'s
`Fonts` object: `Platform.select({ ios: 'System', android: 'sans-serif' })`),
so Dynamic Type / font-scaling behaves natively with zero setup.

To ship a custom font:

1. Add the font file(s) under `assets/fonts/`.
2. Load them with `expo-font` (already a dependency) — either
   `useFonts()` in `src/app/_layout.tsx` and gate rendering on `fontsLoaded`,
   or the `expo-font` config plugin to embed them natively.
3. Point `Fonts.regular` / `medium` / `semibold` / `bold` in
   `src/constants/theme.ts` at your loaded family names, keeping the same
   keys — every component reads through these tokens, so nothing else
   changes.

## Home sections

The Home screen is data-driven by `storefrontUIConfig` in
[`src/config/storefront-ui.ts`](../src/config/storefront-ui.ts):
`resolveHomeSections()` matches configured sections against the collections
and products the store actually returns, dropping anything that resolves to
nothing (e.g. a `handles` list with no matches) rather than rendering an empty
section.

```ts
export const storefrontUIConfig: StorefrontUIConfig = {
  home: {
    sections: [
      { type: 'announcement', text: 'Free shipping over $50' },
      {
        type: 'hero',
        title: 'Designed for everyday living',
        body: 'Explore considered essentials selected for quality and lasting use.',
        imageUrl: 'https://cdn.shopify.com/…',
        action: { label: 'Shop all collections', href: '/shop' },
      },
      // Pin specific collections by handle, in order; anything else fills the remaining slots.
      { type: 'collections', title: 'Shop by collection', handles: ['new-arrivals', 'bestsellers'], limit: 6 },
      { type: 'products', title: 'Featured products', limit: 8 },
      {
        type: 'trust',
        title: 'Shop with confidence',
        items: [
          { title: 'Secure checkout', body: 'Payments are completed securely through Shopify.' },
          { title: 'Customer support', body: 'Questions are welcome before and after your order.' },
        ],
      },
    ],
  },
  product: {
    services: [
      { title: 'Shipping & returns', body: 'Shipping and return details are confirmed at checkout.' },
    ],
  },
};
```

Section types (`HomeSectionConfig` in the same file):

| `type` | Fields | Notes |
| --- | --- | --- |
| `announcement` | `text` | Dropped if `text` is blank after trimming. |
| `hero` | `title`, `body?`, `imageUrl?`, `action?: { label, href }` | `href` is a typed `StorefrontRoute` (`/shop`, `/search`, `/collection/:handle`, `/product/:handle`). |
| `collections` | `title`, `handles?`, `limit?` | Pinned handles first, then the store's remaining collections fill up to `limit`. |
| `products` | `title`, `handles?`, `limit?` | Same resolution as `collections`. |
| `trust` | `title?`, `items: { title, body? }[]` | Empty-title items are filtered out. |

## PDP service disclosures

`storefrontUIConfig.product.services` (same file) feeds the collapsible
`ServiceDisclosure` accordions shown on the product page (shipping/returns,
care instructions, etc. — plain copy, not tied to Shopify data). Add, remove,
or reword entries directly in the array; each renders as
`<ServiceDisclosure title={…} body={…} />`.

## Adding a screen

Routes live under `src/app/` (Expo Router, typed routes on — see
[AGENTS.md](../AGENTS.md)); everything else (data, logic, non-route
components) belongs in `src/`.

1. Create the file, e.g. `src/app/about.tsx`, exporting a default component.
2. If it needs custom header options (title, presentation), add a
   `<Stack.Screen name="about" options={{ title: 'About' }} />` entry in
   `src/app/_layout.tsx`'s `<Stack>` — see the existing entries for `saved`,
   `setup`, `account/orders`, etc.
3. Navigate to it with a typed path: `router.push('/about')`. TypeScript
   flags a typo or a route that doesn't exist.
4. Put any test for a route's logic in `src/components/commerce/*-routes.test.tsx`
   (e.g. `account-routes.test.tsx`, `discovery-routes.test.tsx`) — **not**
   under `src/app/`, which Expo Router treats as a route module for every file
   it contains, tests included. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Adding a GraphQL query

Follow the existing pattern in `src/shopify/queries.ts` + `hooks.ts`:

1. **Write the operation** in `queries.ts`, reusing the shared fragments
   (`MONEY`, `IMAGE`, `PRODUCT_CARD`, …) where they fit. If the query should
   respect Markets localization, declare the two optional variables and the
   directive exactly like every other localized query:

   ```graphql
   query MyQuery($handle: String!, $country: CountryCode, $language: LanguageCode)
     @inContext(country: $country, language: $language) {
     …
   }
   ```

2. **Add a hook** in `hooks.ts` that calls `storefront<TResult>(MY_QUERY, {
   handle, ...inContextVariables() })` — `inContextVariables()`
   (`src/shopify/locale.ts`) resolves to `{ country, language }` or `{}` when
   localization is off, so the query works whether or not `@inContext` applies.
3. **Cache key** — give `useQuery`/`useInfiniteQuery` a `queryKey` that
   includes every input the result depends on (handle, filters, sort, page
   cursor), the same way `useCollection` does.
4. Export any new response/variable types from `src/shopify/types.ts` if
   they're reused outside the hook.

Demo mode (`mock.shop`) strips `@inContext` automatically
(`stripInContextDirective` in `client.ts`), so a new localized query still
works unmodified against the demo catalog.

## Turning features on/off

Every optional feature is controlled entirely by `.env` — see the
[README's Configuration tables](../README.md#configuration) for the full
list. In short: leave a section's variables blank to ship without it
(Customer accounts, Push, Analytics, Crash reporting, Accelerated checkout,
Universal Links); set `EXPO_PUBLIC_DEMO_MODE=off` to force the setup wall
instead of the mock.shop fallback.

## Removing an integration completely

Each optional integration follows the pattern in
[architecture.md](architecture.md#optional-integrations-pattern): a no-op
module plus a conditionally-added config plugin. To remove one for good
(not just turn it off), delete all four layers. Using **OneSignal** as a
worked example:

1. **The module** — delete `src/notifications/onesignal.tsx`.
2. **The mount point** — remove the `<PushProvider>` wrapper (and its import)
   from `src/app/_layout.tsx`, and the `identifyPushUser` / `resetPushUser`
   calls (and their import) from `src/shopify/auth.tsx`.
3. **The config plugin** — delete `onesignalAppId`, `onesignalMode`, and
   `onesignalPlugin` from `app.config.ts`, and remove `...onesignalPlugin`
   from the `plugins` array.
4. **The env vars** — remove `EXPO_PUBLIC_ONESIGNAL_APP_ID` and
   `EXPO_PUBLIC_ONESIGNAL_IOS_MODE` from `.env.example`, any reference in
   `src/shopify/env.ts` (OneSignal reads `process.env` directly, so there's
   none), and their rules in `scripts/env-rules.cjs`.
5. **The dependencies** — `npm uninstall react-native-onesignal onesignal-expo-plugin`.
6. **The docs** — delete `docs/push-notifications.md` and its links from
   `README.md`.
7. Run `npm run verify` and `npx expo-doctor` to confirm nothing still
   references the removed module.

The same seven steps apply to Sentry (`src/lib/monitoring.ts`,
`@sentry/react-native/expo` plugin, `EXPO_PUBLIC_SENTRY_DSN` /
`SENTRY_ORG` / `SENTRY_PROJECT`, `@sentry/react-native`), PostHog
(`src/lib/analytics.ts`, no plugin, `EXPO_PUBLIC_POSTHOG_KEY` /
`_HOST`, `posthog-react-native`), and accelerated checkout
(`src/components/commerce/accelerated-checkout.tsx`,
`src/shopify/accelerated-checkout-config.ts`, the Apple Pay entitlement block
in `app.config.ts`, `EXPO_PUBLIC_SHOPIFY_ACCELERATED_CHECKOUT` /
`EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID`).
