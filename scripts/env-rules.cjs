'use strict';

/**
 * Pure validation rules for `.env` — no file I/O, no network, no process.env
 * reads. `scripts/check-env.mjs` gathers the actual values and calls these;
 * `scripts/env-rules.test.cjs` exercises them directly. Written as CommonJS
 * so Jest (which runs this repo's tests without an ESM-aware transform
 * config for plain `scripts/*`) can `require()` it with no extra setup.
 *
 * Every check returns one or more `{ key, level, message }` results.
 * `level` is `'ok'` | `'info'` | `'warn'` | `'error'`. Only `'error'` should
 * make the calling script exit non-zero.
 */

/** The `EXPO_PUBLIC_*` vars this template defines, kept in sync with `.env.example`. */
const KNOWN_ENV_KEYS = [
  'EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN',
  'EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN',
  'EXPO_PUBLIC_SHOPIFY_API_VERSION',
  'EXPO_PUBLIC_DEMO_MODE',
  'EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID',
  'EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL',
  'EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_MANAGE_URL',
  'EXPO_PUBLIC_APP_NAME',
  'EXPO_PUBLIC_APP_SLUG',
  'EXPO_PUBLIC_APP_SCHEME',
  'EXPO_PUBLIC_APP_BUNDLE_ID',
  'EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS',
  'EXPO_PUBLIC_BRAND_PRIMARY',
  'EXPO_PUBLIC_BRAND_ON_PRIMARY',
  'EXPO_PUBLIC_BRAND_SALE',
  'EXPO_PUBLIC_APP_BACKGROUND',
  'EXPO_PUBLIC_APP_COLOR_SCHEME',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_ABOUT_URL',
  'EXPO_PUBLIC_SHOPIFY_COUNTRY',
  'EXPO_PUBLIC_SHOPIFY_LANGUAGE',
  'EXPO_PUBLIC_SHOPIFY_LOCALIZE',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_ONESIGNAL_APP_ID',
  'EXPO_PUBLIC_ONESIGNAL_IOS_MODE',
  'EXPO_PUBLIC_SENTRY_DSN',
];

const PLACEHOLDER_DOMAIN_PREFIXES = ['your-store', 'example-store'];
const PLACEHOLDER_BUNDLE_ID = 'com.example.storefront';

const MYSHOPIFY_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
const API_VERSION_FORMAT = /^(\d{4})-(\d{2})$/;
const REVERSE_DNS = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*$/i;
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const CUSTOMER_ACCOUNT_URL = /^https:\/\/shopify\.com\/authentication\/(\d+)$/;
const BARE_HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ok(key, message) {
  return { key, level: 'ok', message };
}
function info(key, message) {
  return { key, level: 'info', message };
}
function warn(key, message) {
  return { key, level: 'warn', message };
}
function error(key, message) {
  return { key, level: 'error', message };
}

function isBlank(value) {
  return !value || !value.trim();
}

/** `EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN` — required, permanent myshopify.com domain. */
function checkStoreDomain(value) {
  const key = 'EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN';
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) {
    return [error(key, 'Required — your permanent *.myshopify.com domain.')];
  }
  const isPlaceholder = PLACEHOLDER_DOMAIN_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  if (isPlaceholder) {
    return [warn(key, `"${trimmed}" looks like a placeholder — replace it with your real store domain.`)];
  }
  if (!MYSHOPIFY_DOMAIN.test(trimmed)) {
    return [
      warn(
        key,
        `"${trimmed}" isn't a *.myshopify.com domain. Use the permanent myshopify.com domain, not a custom/connected domain.`,
      ),
    ];
  }
  return [ok(key, trimmed)];
}

/** `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` — required, just checks presence. */
function checkStorefrontToken(value) {
  const key = 'EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN';
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) {
    return [error(key, 'Required — Storefront API access token (Shopify admin → Develop apps).')];
  }
  return [ok(key, `set (${trimmed.length} characters)`)];
}

/**
 * `EXPO_PUBLIC_SHOPIFY_API_VERSION` — `YYYY-MM`, not more than ~12 months
 * behind `now` (Shopify ships quarterly, so a year covers ~4 releases).
 */
function checkApiVersion(value, now = new Date()) {
  const key = 'EXPO_PUBLIC_SHOPIFY_API_VERSION';
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) {
    return [warn(key, 'Not set — defaults to 2026-07 in src/shopify/env.ts.')];
  }
  const match = API_VERSION_FORMAT.exec(trimmed);
  if (!match) {
    return [error(key, `"${trimmed}" isn't in YYYY-MM format, e.g. 2026-07.`)];
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return [error(key, `"${trimmed}" has an invalid month.`)];
  }
  const monthsOld = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
  if (monthsOld > 12) {
    return [
      warn(key, `${trimmed} is over a year old — check shopify.dev for the current stable version.`),
    ];
  }
  if (monthsOld < -3) {
    return [warn(key, `${trimmed} is more than a quarter in the future — double-check it's a real release.`)];
  }
  return [ok(key, trimmed)];
}

/** `EXPO_PUBLIC_APP_BUNDLE_ID` — reverse-DNS, and shouldn't ship as the template default. */
function checkBundleId(value) {
  const key = 'EXPO_PUBLIC_APP_BUNDLE_ID';
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) {
    return [warn(key, `Not set — defaults to "${PLACEHOLDER_BUNDLE_ID}" (must change before publishing).`)];
  }
  const results = [];
  if (!REVERSE_DNS.test(trimmed)) {
    results.push(warn(key, `"${trimmed}" doesn't look like reverse-DNS (e.g. com.yourcompany.app).`));
  }
  if (trimmed === PLACEHOLDER_BUNDLE_ID) {
    results.push(warn(key, `Still the template default "${PLACEHOLDER_BUNDLE_ID}" — change it before publishing.`));
  }
  if (results.length === 0) results.push(ok(key, trimmed));
  return results;
}

/** `EXPO_PUBLIC_APP_SCHEME` — must be a valid URL-scheme token. */
function checkScheme(value) {
  const key = 'EXPO_PUBLIC_APP_SCHEME';
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) return [warn(key, 'Not set — defaults to "shopstore".')];
  if (!URL_SCHEME.test(trimmed)) {
    return [error(key, `"${trimmed}" isn't a valid URL scheme (letters, digits, +, ., - only, starting with a letter).`)];
  }
  return [ok(key, trimmed)];
}

/** A single hex-colour env var. */
function checkHexColor(key, value) {
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) return [ok(key, 'using default')];
  if (!HEX_COLOR.test(trimmed)) {
    return [warn(key, `"${trimmed}" isn't a #rgb or #rrggbb hex colour.`)];
  }
  return [ok(key, trimmed)];
}

/** `EXPO_PUBLIC_APP_COLOR_SCHEME` — `light` | `dark` | `system`. */
function checkColorScheme(value) {
  const key = 'EXPO_PUBLIC_APP_COLOR_SCHEME';
  const trimmed = (value ?? '').trim().toLowerCase();
  if (isBlank(trimmed)) return [ok(key, 'system (default)')];
  if (!['light', 'dark', 'system'].includes(trimmed)) {
    return [warn(key, `"${value}" isn't light, dark, or system — falls back to automatic.`)];
  }
  return [ok(key, trimmed)];
}

/**
 * `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL` (+ CLIENT_ID) — optional,
 * but when present must match `https://shopify.com/authentication/<digits>`.
 * Prints the exact callback URI to register with Shopify when valid.
 */
function checkCustomerAccounts(apiUrl, clientId) {
  const apiKey = 'EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL';
  const clientKey = 'EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID';
  const trimmedUrl = (apiUrl ?? '').trim();
  const trimmedClient = (clientId ?? '').trim();

  if (isBlank(trimmedUrl) && isBlank(trimmedClient)) {
    return [info(apiKey, 'Not set — customer accounts are off.')];
  }

  const results = [];
  const match = CUSTOMER_ACCOUNT_URL.exec(trimmedUrl);
  if (!match) {
    results.push(
      error(apiKey, `"${trimmedUrl}" must look like https://shopify.com/authentication/<shop-id>.`),
    );
  } else {
    const shopId = match[1];
    results.push(ok(apiKey, trimmedUrl));
    results.push(info(apiKey, `Register this callback URI in Shopify: shop.${shopId}.app://callback`));
  }
  if (isBlank(trimmedClient)) {
    results.push(warn(clientKey, 'Customer Account API URL is set but the client id is blank.'));
  } else {
    results.push(ok(clientKey, 'set'));
  }
  if (!match && !isBlank(trimmedClient)) {
    results.push(warn(apiKey, 'Client id is set but the Customer Account API URL is missing/invalid.'));
  }
  return results;
}

/** A URL that must be https when present (management/about links). */
function checkHttpsUrl(key, value) {
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) return [info(key, 'not set')];
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return [warn(key, `"${trimmed}" isn't a valid URL.`)];
  }
  if (parsed.protocol !== 'https:') {
    return [warn(key, `"${trimmed}" must be https:// — the app hides this link otherwise.`)];
  }
  return [ok(key, trimmed)];
}

/** `EXPO_PUBLIC_SUPPORT_EMAIL` — optional, basic format check. */
function checkSupportEmail(value) {
  const key = 'EXPO_PUBLIC_SUPPORT_EMAIL';
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) return [info(key, 'not set')];
  if (!EMAIL_FORMAT.test(trimmed) || /[\r\n]/.test(trimmed)) {
    return [warn(key, `"${trimmed}" doesn't look like a valid email address.`)];
  }
  return [ok(key, trimmed)];
}

/** `EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS` — comma-separated bare hosts. */
function checkUniversalLinkDomains(value) {
  const key = 'EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS';
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) return [info(key, 'not set — universal/app links are off')];
  const hosts = trimmed.split(',').map((host) => host.trim()).filter(Boolean);
  const bad = hosts.filter((host) => !BARE_HOST.test(host));
  if (bad.length > 0) {
    return [
      warn(
        key,
        `${bad.join(', ')} — list bare hosts only (no scheme/path), e.g. shop.example.com,www.example.com.`,
      ),
    ];
  }
  return [ok(key, hosts.join(', '))];
}

/** `EXPO_PUBLIC_ONESIGNAL_IOS_MODE` — `development` | `production`. */
function checkOneSignalMode(value) {
  const key = 'EXPO_PUBLIC_ONESIGNAL_IOS_MODE';
  const trimmed = (value ?? '').trim().toLowerCase();
  if (isBlank(trimmed)) return [ok(key, 'development (default)')];
  if (!['development', 'production'].includes(trimmed)) {
    return [warn(key, `"${value}" must be development or production.`)];
  }
  return [ok(key, trimmed)];
}

/** `EXPO_PUBLIC_SENTRY_DSN` — optional, must look like a DSN URL when set. */
function checkSentryDsn(value) {
  const key = 'EXPO_PUBLIC_SENTRY_DSN';
  const trimmed = (value ?? '').trim();
  if (isBlank(trimmed)) return [info(key, 'not set — Sentry is off')];
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return [warn(key, `"${trimmed}" isn't a valid DSN URL.`)];
  }
  if (parsed.protocol !== 'https:' || !parsed.username) {
    return [warn(key, `"${trimmed}" doesn't look like a Sentry DSN (expected https://<key>@host/<project>).`)];
  }
  return [ok(key, 'set')];
}

/** Flags `EXPO_PUBLIC_*` keys present in the environment but not part of this template. */
function checkUnknownKeys(envKeys, knownKeys = KNOWN_ENV_KEYS) {
  const known = new Set(knownKeys);
  const unknown = envKeys.filter((k) => k.startsWith('EXPO_PUBLIC_') && !known.has(k));
  return unknown.map((key) => warn(key, 'Not a var this template reads — check for a typo.'));
}

/**
 * Builds the full report for a plain object of env values (e.g. `process.env`
 * after Node's `--env-file-if-exists` has loaded `.env`). Pure — no I/O.
 */
function buildReport(env, now = new Date()) {
  const results = [
    ...checkStoreDomain(env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN),
    ...checkStorefrontToken(env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN),
    ...checkApiVersion(env.EXPO_PUBLIC_SHOPIFY_API_VERSION, now),
    ...checkBundleId(env.EXPO_PUBLIC_APP_BUNDLE_ID),
    ...checkScheme(env.EXPO_PUBLIC_APP_SCHEME),
    ...checkHexColor('EXPO_PUBLIC_BRAND_PRIMARY', env.EXPO_PUBLIC_BRAND_PRIMARY),
    ...checkHexColor('EXPO_PUBLIC_BRAND_ON_PRIMARY', env.EXPO_PUBLIC_BRAND_ON_PRIMARY),
    ...checkHexColor('EXPO_PUBLIC_BRAND_SALE', env.EXPO_PUBLIC_BRAND_SALE),
    ...checkHexColor('EXPO_PUBLIC_APP_BACKGROUND', env.EXPO_PUBLIC_APP_BACKGROUND),
    ...checkColorScheme(env.EXPO_PUBLIC_APP_COLOR_SCHEME),
    ...checkCustomerAccounts(
      env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL,
      env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
    ),
    ...checkHttpsUrl('EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_MANAGE_URL', env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_MANAGE_URL),
    ...checkHttpsUrl('EXPO_PUBLIC_ABOUT_URL', env.EXPO_PUBLIC_ABOUT_URL),
    ...checkSupportEmail(env.EXPO_PUBLIC_SUPPORT_EMAIL),
    ...checkUniversalLinkDomains(env.EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS),
    ...checkOneSignalMode(env.EXPO_PUBLIC_ONESIGNAL_IOS_MODE),
    ...checkSentryDsn(env.EXPO_PUBLIC_SENTRY_DSN),
    ...checkUnknownKeys(Object.keys(env)),
  ];

  const hasErrors = results.some((r) => r.level === 'error');
  return { results, hasErrors };
}

module.exports = {
  KNOWN_ENV_KEYS,
  checkStoreDomain,
  checkStorefrontToken,
  checkApiVersion,
  checkBundleId,
  checkScheme,
  checkHexColor,
  checkColorScheme,
  checkCustomerAccounts,
  checkHttpsUrl,
  checkSupportEmail,
  checkUniversalLinkDomains,
  checkOneSignalMode,
  checkSentryDsn,
  checkUnknownKeys,
  buildReport,
};
