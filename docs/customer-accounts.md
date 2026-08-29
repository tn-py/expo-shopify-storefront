# Customer accounts (Shopify Customer Account API)

Optional. Leave `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` /
`EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL` blank to ship without accounts —
the "Sign in" button then explains it isn't configured.

## What's implemented

Full OAuth 2.0 + PKCE flow for a **mobile public client**:

- `src/shopify/auth.tsx` — `AuthProvider` / `useAuth()`: sign in, sign out, token
  storage in `expo-secure-store`, silent refresh, profile load.
- `src/shopify/customer.ts` — `customerGraphql()` helper + `useOrders`, `useOrder`,
  `useAddresses` hooks (validated against Customer Account API `2026-07`).
- Screens: `src/app/account/orders.tsx`, `src/app/account/order/[id].tsx`,
  `src/app/account/addresses.tsx`; entry point in `src/app/(tabs)/account.tsx`.

## Endpoints

Derived from `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL`
(`https://shopify.com/authentication/<shop-id>`):

| Purpose | URL |
| --- | --- |
| Authorize | `…/authentication/<shop-id>/oauth/authorize` |
| Token | `…/authentication/<shop-id>/oauth/token` |
| Logout | `…/authentication/<shop-id>/logout` |
| GraphQL | `https://shopify.com/<shop-id>/account/customer/api/<version>/graphql` (note: **no** `/authentication` segment) |

Scopes requested: `openid email customer-account-api:full`.

## Two things to configure in Shopify

### 1. Register the mobile callback URL

Shopify requires mobile callbacks to use the scheme `shop.<shop-id>.*`. This app
derives it from your Customer Account API URL, so the callback is:

```
shop.<shop-id>.app://callback
```

Add it as an allowed **Callback URI** on the store's Customer Account API client:
**Settings → Customer accounts → API / Application setup** (or the Headless
channel's *Customer Account API → Application setup → Callback URI(s)*).

### 2. Rebuild the dev client

The `shop.<shop-id>.app` URL scheme is added by `app.config.ts` but only lands in
the native binary on the next build:

```sh
eas build --profile development --platform android
```

Until then the browser can't hand the auth code back to the app and Shopify
returns *"Invalid redirect_uri scheme"*.

## Verify

Sign in → Shopify login → back to the app authenticated → Account shows your name
→ **Orders** and **Addresses** load from the Customer Account API.
