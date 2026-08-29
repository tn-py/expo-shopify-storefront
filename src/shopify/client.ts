import { createStorefrontApiClient } from '@shopify/storefront-api-client';

import { ShopifyEnv } from './env';

/**
 * Shared Storefront API client. Uses the public access token, which is safe to
 * ship in the app bundle (it only grants unauthenticated storefront scopes).
 */
export const storefrontClient = createStorefrontApiClient({
  storeDomain: ShopifyEnv.storeDomain,
  apiVersion: ShopifyEnv.apiVersion,
  publicAccessToken: ShopifyEnv.storefrontToken,
  clientName: 'expo-shopify-storefront',
  retries: 2,
});

export class StorefrontError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'StorefrontError';
  }
}

/**
 * Run a Storefront GraphQL operation and return typed `data`, throwing on any
 * network or GraphQL error so React Query can surface it.
 */
export async function storefront<TData = unknown>(
  operation: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const { data, errors } = await storefrontClient.request<TData>(operation, {
    variables,
  });

  // Shopify can return partial data alongside field-level errors (e.g. a field
  // that needs a scope the token lacks). Only fail hard when there's no data.
  if (data == null) {
    throw new StorefrontError(
      errors?.message ?? 'Storefront API returned no data',
      errors,
    );
  }
  if (errors) {
    console.warn('[storefront] partial GraphQL errors:', errors.message ?? errors);
  }
  return data;
}
