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

## Authenticated checkout

Once a customer is signed in, `CartProvider` (`src/shopify/cart.tsx`) associates
the cart with their identity via `cartBuyerIdentityUpdate`, so the Checkout
Sheet opens a **logged-in Checkout** — vaulted cards, store credit, and saved
addresses, the same as on shopify.com:

- The buyer identity sent is `{ customerAccessToken, countryCode }` — a fresh
  Customer Account API access token (via `useAuth().getAccessToken()`, which
  refreshes it first if it's near expiry) plus the shopper's market country
  from `src/shopify/locale.ts`. Guests get `{ countryCode }` only — no email.
- The synchronization key that decides whether a re-sync is needed includes a
  short, non-reversible fingerprint of the token (`fingerprintToken` in
  `src/shopify/cart-operations.ts`), not the raw token, so a rotated token
  (silent refresh) is detected and re-synced without ever putting the token
  itself in app state or logs.
- `useCheckout()` re-runs this sync immediately before presenting the sheet,
  so checkout is never opened with a stale or expired identity.
- If Shopify rejects the token (`userErrors` on `cartBuyerIdentityUpdate` —
  e.g. it expired in the gap between fetching and sending it), the cart falls
  back to the previous **email-based** identity so checkout still works. This
  fallback is tracked once as the `checkout_identity_fallback` analytics
  event and does not retry in a loop for the same token.

## Sign-out privacy

Signing out must not leave a shared device's cart carrying the previous
customer's identity. `CartProvider` detects the signed-in → guest transition
and rebuilds a **new guest cart** with the same lines (reusing the same
cart-creation path as stale-cart recovery), persists its id, and drops the
old one — guarded by the same snapshot sequencer as every other cart
mutation, so a concurrent add/update can't resurrect the old cart.

Separately, `AuthProvider.signOut()` (`src/shopify/auth.tsx`) makes a
**best-effort** call to Shopify's Customer Account API end-session endpoint —
`${customerAccountApiUrl}/logout?id_token_hint=<idToken>` (mobile clients get
a `200 OK` rather than a redirect) — with a 5-second timeout. It's
fire-and-forget: local sign-out (clearing tokens, the customer profile, and
every cached customer query) always completes immediately regardless of
whether that call succeeds, fails, or hangs. It's skipped entirely when no id
token was stored (e.g. the automatic cleanup after a failed silent refresh).

Analytics identify the customer by their stable Shopify **customer GID**
(`identify(customer.id, { email })` in `src/shopify/auth.tsx`), never by
email — the email is only ever attached as a PostHog person property. Sentry
(`setMonitoringUser`) is set to the same GID on profile load and cleared to
`null` on sign-out. OneSignal's push identity is unchanged (still keyed by
customer id, falling back to email).

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

Only `https://` URLs are opened; `http://`, malformed, and non-web values hide
the action. This is the sole address-management handoff. The app does not
implement native address create, update, or delete mutations.

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
