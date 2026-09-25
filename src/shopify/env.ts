/**
 * Centralised access to the EXPO_PUBLIC_* Shopify configuration.
 * Expo inlines these at build time from `.env.local` / EAS env.
 */

const customerAccountApiUrl =
  process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL ?? '';

/** The numeric shop id embedded in the Customer Account API auth URL. */
const shopId = customerAccountApiUrl.match(/authentication\/(\d+)/)?.[1] ?? '';

export const ShopifyEnv = {
  /** Custom URL scheme for this app (also set in app.config.ts). */
  appScheme: process.env.EXPO_PUBLIC_APP_SCHEME?.trim() || 'shopstore',
  storeDomain: process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN ?? '',
  storefrontToken: process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? '',
  apiVersion: process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION ?? '2026-07',
  customerAccountClientId:
    process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID ?? '',
  /** Hosted Shopify customer-account page used for view-only address management. */
  customerAccountManagementUrl:
    process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_MANAGE_URL?.trim() ?? '',
  /** OAuth base, e.g. https://shopify.com/authentication/<shop-id> */
  customerAccountApiUrl,
  shopId,
  /**
   * Customer Account GraphQL endpoint — note this drops the `/authentication`
   * segment: https://shopify.com/<shop-id>/account/customer/api/<version>/graphql
   */
  customerAccountGraphqlUrl: shopId
    ? `https://shopify.com/${shopId}/account/customer/api/${
        process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION ?? '2026-07'
      }/graphql`
    : '',
  /**
   * Redirect scheme Shopify requires for a mobile Customer Account API public
   * client: `shop.<shop-id>.*` (registered in app.config.ts + Shopify admin).
   */
  customerAccountScheme: shopId ? `shop.${shopId}.app` : '',
  /**
   * Markets / @inContext overrides — raw values, validated and defaulted by
   * `src/shopify/locale.ts`. `localize` is `device` (default) | `off`.
   */
  country: process.env.EXPO_PUBLIC_SHOPIFY_COUNTRY?.trim() ?? '',
  language: process.env.EXPO_PUBLIC_SHOPIFY_LANGUAGE?.trim() ?? '',
  localize: process.env.EXPO_PUBLIC_SHOPIFY_LOCALIZE?.trim() ?? 'device',
  /**
   * Accelerated checkout (Shop Pay / Apple Pay wallet buttons), opt-in and
   * iOS-only — see `docs/accelerated-checkout.md`. Off by default: the
   * merchant must request the `write_cart_wallet_payments` Storefront API
   * scope from Shopify before enabling it.
   */
  acceleratedCheckoutEnabled:
    (process.env.EXPO_PUBLIC_SHOPIFY_ACCELERATED_CHECKOUT?.trim() ?? '').toLowerCase() === 'true',
  /** Apple merchant id (e.g. `merchant.com.example`) — Apple Pay is offered only when set; Shop Pay otherwise. */
  applePayMerchantId: process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID?.trim() ?? '',
} as const;

export const isStorefrontConfigured =
  ShopifyEnv.storeDomain.length > 0 &&
  !ShopifyEnv.storeDomain.startsWith('your-store') &&
  !ShopifyEnv.storeDomain.startsWith('example-store') &&
  ShopifyEnv.storefrontToken.length > 0;

export const isCustomerAccountConfigured =
  ShopifyEnv.customerAccountClientId.length > 0 &&
  ShopifyEnv.shopId.length > 0;

/**
 * `EXPO_PUBLIC_DEMO_MODE` — on by default. Set to `off` to always show the
 * setup wall instead of falling back to the mock.shop demo store when no
 * Storefront API credentials are configured.
 */
const demoModeEnv = process.env.EXPO_PUBLIC_DEMO_MODE?.trim().toLowerCase() ?? '';

/**
 * `true` when there's no configured store but the app can still show a
 * working storefront by talking to Shopify's public mock.shop demo API (see
 * `src/shopify/client.ts`). Demo mode is on by default and only turns off
 * when a real store is configured or `EXPO_PUBLIC_DEMO_MODE=off`.
 */
export const isDemoStore = !isStorefrontConfigured && demoModeEnv !== 'off';

/** Whether the app has a storefront to render at all — real or demo. */
export const isStorefrontUsable = isStorefrontConfigured || isDemoStore;
