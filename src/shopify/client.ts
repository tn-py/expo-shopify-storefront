import {
  createStorefrontApiClient,
  type StorefrontApiClient,
} from '@shopify/storefront-api-client';

import { isDemoStore, ShopifyEnv } from './env';

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
 * Public Storefront-API-compatible mock Shopify runs with sample products and
 * collections, no token required. Used only in demo mode (see `env.ts`).
 */
const MOCK_SHOP_ENDPOINT = 'https://mock.shop/api';

/**
 * The real client is created lazily, on the first non-demo request, so a
 * blank/invalid domain (e.g. `npx expo export` with no `.env`, or the app
 * running entirely in demo mode) can never throw at import time.
 */
let realClient: StorefrontApiClient | undefined;

function getStorefrontClient(): StorefrontApiClient {
  if (!realClient) {
    realClient = createStorefrontApiClient({
      storeDomain: ShopifyEnv.storeDomain,
      apiVersion: ShopifyEnv.apiVersion,
      publicAccessToken: ShopifyEnv.storefrontToken,
      clientName: 'expo-shopify-storefront',
      retries: 2,
    });
  }
  return realClient;
}

/** Test-only escape hatch so each test case starts from a clean memoized client. */
export function __resetStorefrontClientForTests(): void {
  realClient = undefined;
}

/**
 * Strips the `@inContext(country: ..., language: ...)` directive — and the
 * `$country` / `$language` variable declarations it leaves unused once
 * removed — from an operation's GraphQL text. mock.shop's schema doesn't
 * support every directive a newer, configured store's queries may use, so
 * demo-mode requests are sanitized before being sent. Safe to run on an
 * operation that never had the directive: it's then a no-op.
 */
export function stripInContextDirective(operation: string): string {
  return operation
    .replace(/@inContext\s*\([^)]*\)/g, '')
    .replace(/,?\s*\$country\s*:\s*CountryCode!?(?:\s*=\s*[A-Za-z0-9_]+)?/g, '')
    .replace(/,?\s*\$language\s*:\s*LanguageCode!?(?:\s*=\s*[A-Za-z0-9_]+)?/g, '')
    .replace(/\(\s*,\s*/g, '(')
    .replace(/,\s*\)/g, ')')
    .replace(/\(\s*\)/g, '');
}

/** Drops the `country` / `language` variables mock.shop's schema doesn't expect. */
function stripLocaleVariables(
  variables: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!variables) return variables;
  const { country, language, ...rest } = variables;
  return rest;
}

interface GraphQlEnvelope<TData> {
  data?: TData;
  errors?: { message: string };
}

async function requestFromMockShop<TData>(
  operation: string,
  variables?: Record<string, unknown>,
): Promise<GraphQlEnvelope<TData>> {
  let response: Response;
  try {
    response = await fetch(MOCK_SHOP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: stripInContextDirective(operation),
        variables: stripLocaleVariables(variables) ?? {},
      }),
    });
  } catch (cause) {
    throw new StorefrontError('Could not reach the mock.shop demo API', cause);
  }

  if (!response.ok) {
    throw new StorefrontError(`mock.shop request failed (${response.status})`, {
      status: response.status,
    });
  }

  // Raw GraphQL responses carry `errors` as an array; normalize to the
  // `{ message }` shape `@shopify/storefront-api-client` returns.
  const json = (await response.json()) as {
    data?: TData;
    errors?: { message?: string }[];
  };
  const errors = json.errors?.length
    ? { message: json.errors.map((error) => error.message).filter(Boolean).join('; ') }
    : undefined;
  return { data: json.data, errors };
}

/**
 * Run a Storefront GraphQL operation and return typed `data`, throwing on any
 * network or GraphQL error so React Query can surface it. In demo mode (no
 * store configured, `EXPO_PUBLIC_DEMO_MODE` not `off`) this transparently
 * targets Shopify's public mock.shop API instead of a real store.
 */
export async function storefront<TData = unknown>(
  operation: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const { data, errors } = isDemoStore
    ? await requestFromMockShop<TData>(operation, variables)
    : await getStorefrontClient().request<TData>(operation, { variables });

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
