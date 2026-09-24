#!/usr/bin/env node
/**
 * Validates `.env` and (unless `--offline`) pings the Storefront API with the
 * configured domain/token. Node 22, zero deps.
 *
 * Usage: `npm run check:env` (equivalent to
 * `node --env-file-if-exists=.env scripts/check-env.mjs`), or add `--offline`
 * to skip the network check.
 *
 * Pure validation rules live in `scripts/env-rules.cjs` (Jest-tested); this
 * file is just I/O — reading `.env`, printing the report, and the network
 * ping.
 *
 * Node's own `--env-file` flag (used by the `check:env` script) only
 * recognizes a comment when `#` starts the line — an unquoted value like
 * `EXPO_PUBLIC_BRAND_PRIMARY=#0a7ea4` is parsed as-is, matching Expo's own
 * `.env` loading. We still parse `.env` ourselves below (falling back to
 * `process.env` when there's no `.env` file, e.g. vars injected directly in
 * CI) so this script works the same whether or not that flag is used.
 */

import { readFileSync } from 'node:fs';

import { buildReport } from './env-rules.cjs';

/** Minimal dotenv-compatible parser: `KEY=value`, `KEY="value"`, `KEY='value'`, `# comment` lines. */
function parseDotEnv(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadEnv() {
  let fileEnv = {};
  try {
    fileEnv = parseDotEnv(readFileSync('.env', 'utf8'));
  } catch {
    // No .env file — fall back entirely to process.env (e.g. CI-injected vars).
  }
  return { ...process.env, ...fileEnv };
}

const SYMBOLS = { ok: '✓', info: 'ℹ', warn: '⚠', error: '✗' };
const COLORS = {
  ok: '\x1b[32m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function colorize(level, text) {
  if (!process.stdout.isTTY) return text;
  return `${COLORS[level]}${text}${COLORS.reset}`;
}

function printReport(results) {
  for (const { level, key, message } of results) {
    const symbol = colorize(level, SYMBOLS[level]);
    console.log(`  ${symbol}  ${key}: ${message}`);
  }
}

function summarize(results) {
  const counts = { ok: 0, info: 0, warn: 0, error: 0 };
  for (const r of results) counts[r.level] += 1;
  return counts;
}

/**
 * `{ shop { name } }` against the configured Storefront API, with a 10s
 * timeout. Reports success, bad-token (401/403), bad-domain (404) and other
 * failures distinctly.
 */
async function pingStorefrontApi({ domain, token, apiVersion }) {
  const url = `https://${domain}/api/${apiVersion}/graphql.json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query: '{ shop { name } } ' }),
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: `Storefront API rejected the token (HTTP ${response.status}) — check the token and its scopes.` };
    }
    if (response.status === 404) {
      return { ok: false, message: 'Storefront API returned 404 — check the store domain and API version.' };
    }
    if (!response.ok) {
      return { ok: false, message: `Storefront API request failed (HTTP ${response.status}).` };
    }

    const body = await response.json();
    if (body.errors) {
      const message = Array.isArray(body.errors) ? body.errors[0]?.message : body.errors.message;
      return { ok: false, message: `Storefront API returned an error: ${message ?? JSON.stringify(body.errors)}` };
    }
    const name = body.data?.shop?.name;
    if (!name) {
      return { ok: false, message: 'Storefront API returned no shop data.' };
    }
    return { ok: true, message: `Connected — shop name: "${name}".` };
  } catch (cause) {
    if (cause?.name === 'AbortError') {
      return { ok: false, message: 'Storefront API request timed out after 10s.' };
    }
    return { ok: false, message: `Could not reach the Storefront API: ${cause?.message ?? cause}.` };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const offline = process.argv.includes('--offline');
  const env = loadEnv();

  console.log(colorize('bold', '\nShopify Storefront — environment check\n'));

  const { results, hasErrors } = buildReport(env);
  printReport(results);

  const counts = summarize(results);
  console.log(
    `\n${counts.ok} ok, ${counts.info} info, ${counts.warn} warning${counts.warn === 1 ? '' : 's'}, ${counts.error} error${counts.error === 1 ? '' : 's'}.`,
  );

  let connectivityFailed = false;
  const domain = (env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN ?? '').trim();
  const token = (env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? '').trim();
  const apiVersion = (env.EXPO_PUBLIC_SHOPIFY_API_VERSION ?? '2026-07').trim();

  if (offline) {
    console.log('\n(--offline: skipping the Storefront API connectivity check.)');
  } else if (!domain || !token) {
    console.log('\nSkipping the Storefront API connectivity check — domain and/or token are blank.');
  } else {
    console.log(`\nPinging the Storefront API at ${domain}…`);
    const result = await pingStorefrontApi({ domain, token, apiVersion });
    console.log(`  ${colorize(result.ok ? 'ok' : 'error', result.ok ? SYMBOLS.ok : SYMBOLS.error)}  ${result.message}`);
    connectivityFailed = !result.ok;
  }

  if (hasErrors || connectivityFailed) {
    console.log(colorize('error', '\nFailed — fix the errors above.'));
    process.exitCode = 1;
    return;
  }
  console.log(colorize('ok', '\nLooks good.'));
}

main().catch((error) => {
  console.error('check:env crashed unexpectedly:', error);
  process.exitCode = 1;
});
