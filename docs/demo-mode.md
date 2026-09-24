# Demo mode

With no Shopify store configured, the app doesn't show a blank setup wall — it runs
against [mock.shop](https://mock.shop), Shopify's public, Storefront-API-compatible
sample catalog. No token, no store, no signup: clone the template, `npm install`,
`npm start`, and you have a working storefront in about two minutes.

## How it's decided

`src/shopify/env.ts` exports:

- `isStorefrontConfigured` — a real store domain + token are set in `.env`. Unchanged
  from before demo mode existed.
- `isDemoStore` — `true` when the storefront **isn't** configured and
  `EXPO_PUBLIC_DEMO_MODE` isn't `off` (it's on by default — no env var needs setting).
- `isStorefrontUsable` — `isStorefrontConfigured || isDemoStore`. `(tabs)/_layout.tsx`
  renders the real storefront whenever this is `true`, and only falls back to the
  setup wall when it's `false` (i.e. demo mode was explicitly turned off and no store
  is configured).

Once you set a real `EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN` + `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`,
`isStorefrontConfigured` becomes `true` and the app always uses your store —
`EXPO_PUBLIC_DEMO_MODE` has no effect at that point.

To force the setup wall instead of ever falling back to the demo catalog (useful in
CI, or if you specifically want to verify the "nothing configured" experience), set:

```
EXPO_PUBLIC_DEMO_MODE=off
```

## How requests work

`src/shopify/client.ts`'s `storefront()` keeps the exact same signature and
`{ data, errors }` handling either way. In demo mode it:

- POSTs plain `fetch` requests to `https://mock.shop/api` instead of using the real
  `@shopify/storefront-api-client` client (which is constructed lazily, on first real
  request, so an empty/invalid domain never throws — including during
  `npx expo export` with a blank `.env`).
- Strips any `@inContext(country: ..., language: ...)` directive from the operation
  text and drops the `country`/`language` variables, since mock.shop's schema doesn't
  support every directive a newer, configured store's queries may use.

## What's different in demo mode

- **Browsing, search, cart** work like normal — they're real Storefront API
  operations, just against mock.shop's sample products/collections instead of your
  store.
- **Checkout may not complete.** Tapping Checkout opens `cart.checkoutUrl` from
  mock.shop in the native Checkout Sheet; it's not guaranteed to be a fully working,
  payable checkout the way a real store's is. Treat it as "does the flow open",
  not "can I place a test order" — for that, connect a real development store (see
  [shopify-setup.md](./shopify-setup.md)) and use Bogus Gateway test mode.
- **Customer accounts are off.** `isCustomerAccountConfigured` depends only on
  `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` / `_API_URL`, which are unrelated
  to demo mode — mock.shop has no accounts system, so leave these unset while trying
  the app in demo mode. Account screens show their normal "not configured" state.

## The demo banner

Whenever the app is running in demo mode, a small pill sits just above the tab bar:
**"Demo store · Connect yours."** Tapping it opens `/setup`, a step-by-step guide to
connecting a real store (same steps as `docs/shopify-setup.md`, plus a link to the
full guide). It's dismissible, but only for the current app session — it reappears on
the next launch as a reminder that you're not looking at your own store yet.
