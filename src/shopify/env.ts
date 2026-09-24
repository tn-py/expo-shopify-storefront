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
} as const;

export const isStorefrontConfigured =
  ShopifyEnv.storeDomain.length > 0 &&
  !ShopifyEnv.storeDomain.startsWith('your-store') &&
  !ShopifyEnv.storeDomain.startsWith('example-store') &&
  ShopifyEnv.storefrontToken.length > 0;

export const isCustomerAccountConfigured =
  ShopifyEnv.customerAccountClientId.length > 0 &&
  ShopifyEnv.shopId.length > 0;
