# Customer accounts (Shopify Customer Account API)

Optional. Leave `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` /
`EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL` blank to ship without accounts —
the "Sign in" button then explains it isn't configured.

## What's implemented

Full OAuth 2.0 + PKCE flow for a **mobile public client**:

- `src/shopify/auth.tsx` — `AuthProvider` / `useAuth()`: sign in, sign out, token
  storage in `expo-secure-store`, silent refresh, profile load.
- `src/shopify/customer.ts` — `customerGraphql()` helper + `useOrders`, `useOrder`,
  `useAddresses` hooks (validated against Customer Account API `2026-07`). Query
  keys contain the resolved Shopify customer ID, and sign-out cancels and removes
  every protected customer query.
- Screens: `src/app/account/orders.tsx`, `src/app/account/order/[id].tsx`,
  `src/app/account/addresses.tsx`; entry point in `src/app/(tabs)/account.tsx`.

Protected routes wait for authentication and a successfully loaded customer
profile before mounting their data hooks. A direct order/address deep link while
signed out therefore cannot execute a Customer Account API request or reveal a
previous customer's cached result. The existing profile error remains explicit
and retryable.

Orders include separate payment and fulfillment states, locale dates, item
media/variants, fulfillment tracking, and the cost fields supported by the
configured API version. Addresses use Shopify's locale-aware `formatted` field,
paginate safely, and remain view-only.

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

## Hosted address management

Set the complete hosted Shopify customer-account URL in `.env`:

```sh
EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_MANAGE_URL=https://account.example.com/addresses
```

Only `http://` or `https://` URLs are opened; an invalid value hides the action.
This is the sole address-management handoff. The app does not implement native
address create, update, or delete mutations.

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
→ **Orders** and **Addresses** load from the Customer Account API. Then sign out
from an order screen, sign in as a different customer, and confirm no prior name,
order, address, or loading placeholder reappears. Complete the account cases in
[`manual-qa.md`](./manual-qa.md) on both platforms.
