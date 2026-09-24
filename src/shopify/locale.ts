/**
 * Shopify Storefront API `@inContext(country, language)` locale — derived from
 * the device's locale via `expo-localization`, overridable per `.env`. Later
 * agents attach `@inContext` to queries using this; this module never touches
 * the GraphQL operations itself.
 */

import { getLocales } from 'expo-localization';

import { ShopifyEnv } from '@/shopify/env';

/** ISO 3166-1 alpha-2, e.g. `US`. */
const COUNTRY_CODE = /^[A-Z]{2}$/;
/**
 * Two-letter uppercase language code (Shopify's `LanguageCode` enum matches
 * ISO 639-1 for most languages, e.g. `EN`, `FR`, `JA`). A handful of Shopify
 * languages only exist as a region-qualified variant (e.g. `PT_BR`); those
 * aren't derivable from the device's plain language code, so callers that
 * need one set `EXPO_PUBLIC_SHOPIFY_LANGUAGE` explicitly.
 */
const LANGUAGE_CODE = /^[A-Z]{2}$/;

const DEFAULT_COUNTRY = 'US';
const DEFAULT_LANGUAGE = 'EN';

export type StorefrontLocale = { country: string; language: string };

function deviceLocale() {
  try {
    return getLocales()[0];
  } catch {
    return undefined;
  }
}

function resolveCountry(): string {
  const override = (ShopifyEnv.country ?? '').toUpperCase();
  if (COUNTRY_CODE.test(override)) return override;

  const device = (deviceLocale()?.regionCode ?? '').toUpperCase();
  return COUNTRY_CODE.test(device) ? device : DEFAULT_COUNTRY;
}

function resolveLanguage(): string {
  const override = (ShopifyEnv.language ?? '').toUpperCase();
  if (LANGUAGE_CODE.test(override)) return override;

  const device = (deviceLocale()?.languageCode ?? '').toUpperCase();
  return LANGUAGE_CODE.test(device) ? device : DEFAULT_LANGUAGE;
}

/**
 * `{ country, language }` for Shopify's `@inContext` directive, or `null` when
 * `EXPO_PUBLIC_SHOPIFY_LOCALIZE=off` — callers should skip `@inContext`
 * entirely in that case rather than pass a locale.
 */
export const storefrontLocale: StorefrontLocale | null =
  (ShopifyEnv.localize ?? 'device').toLowerCase() === 'off'
    ? null
    : { country: resolveCountry(), language: resolveLanguage() };

/** The device's current locale as a BCP-47 tag, e.g. `en-US`. Falls back to `en-US`. */
export function deviceLocaleTag(): string {
  return deviceLocale()?.languageTag || 'en-US';
}
