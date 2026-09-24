# Accelerated checkout (Shop Pay / Apple Pay)

Optional, opt-in, **iOS 16+ only**. Off by default. When enabled, a Shop Pay
(and, if configured, Apple Pay) wallet button renders above the regular
checkout button, letting a shopper complete a purchase in one tap without
opening the Checkout Sheet at all.

## What's implemented

- `src/components/commerce/accelerated-checkout.tsx` — `WalletCheckoutButtons`,
  a thin wrapper around `@shopify/checkout-sheet-kit`'s
  `AcceleratedCheckoutButtons`. Takes `{ cartId }` (mounted in the cart
  screen) or `{ variantId, quantity }` (for a product page — see below).
  Renders `null` on Android, when disabled, or once the native buttons report
  they can't render for this cart/variant (`RenderState.Error`, e.g. no
  wallet set up on the device).
- Completion (purchase tracked, cart cleared, navigate to
  `/order-confirmed`) reuses the exact same `handleCheckoutCompletion`
  function as the regular Checkout Sheet (`src/shopify/checkout.tsx`), so
  both paths behave identically.
- `src/shopify/accelerated-checkout-config.ts` — `AcceleratedCheckoutConfigurator`,
  mounted in `src/app/_layout.tsx` next to `CheckoutEvents`. Keeps the native
  SDK's accelerated-checkout configuration (which customer, if any, wallet
  buttons render for) in sync with sign-in state, since
  `ShopifyCheckoutSheetProvider`'s initial `configuration` prop is set once,
  above `AuthProvider`, and can't itself react to auth changes.

## Enabling it

```sh
EXPO_PUBLIC_SHOPIFY_ACCELERATED_CHECKOUT=true
EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID=merchant.com.yourcompany
```

1. **Request the scope.** Ask Shopify to grant your Storefront API app the
   `write_cart_wallet_payments` scope — this isn't self-serve in the admin.
   Wallet buttons won't render without it.
2. **Apple Pay (optional).** In Shopify admin → Settings → Payments → Apple
   Pay, add your Apple Merchant ID and upload the Apple Pay certificate Shopify
   generates for it. Set `EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID` to that same id.
   Apple Pay is offered only when this is set; **Shop Pay is offered either
   way** once accelerated checkout is enabled.
3. **Rebuild.** Setting `EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID` adds the
   `com.apple.developer.in-app-payments` iOS entitlement via `app.config.ts` —
   this only takes effect in a new native build
   (`eas build --profile development --platform ios`), not a Metro reload.

## Adding it to another screen

The cart screen (`src/app/(tabs)/cart.tsx`) already mounts it above the main
checkout button:

```tsx
import { WalletCheckoutButtons } from '@/components/commerce';

<WalletCheckoutButtons cartId={cart.id} />
```

For a product page (buy-now, before anything is added to a cart), use the
variant form instead:

```tsx
import { WalletCheckoutButtons } from '@/components/commerce';

<WalletCheckoutButtons variantId={selectedVariant.id} quantity={quantity} />
```

## Verify

With both env vars set and a fresh dev-client build on a physical iOS 16+
device or simulator signed into a wallet: the cart screen shows a Shop Pay (and
Apple Pay, if configured) button above the regular checkout button; completing
a purchase through it clears the cart and lands on the order-confirmed screen,
same as the regular Checkout Sheet. With the env vars unset, or on Android, no
wallet button renders and the regular checkout button is unaffected.

## Unverified / risky

This couldn't be exercised against a live store or a real device from this
sandbox (no network access to shopify.dev or a Shopify admin, no iOS
simulator). In particular, unverified: whether `ShopifyCheckoutSheetProvider`'s
`setConfig` reliably re-validates `acceleratedCheckouts.customer` for an
**already-rendered** `AcceleratedCheckoutButtons` instance (vs. only affecting
future mounts), and the exact `RenderState.Error` conditions the native SDK
reports. Confirm both on a real device before shipping.
