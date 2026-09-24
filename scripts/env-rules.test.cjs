'use strict';

const {
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
  KNOWN_ENV_KEYS,
} = require('./env-rules.cjs');

function levels(results) {
  return results.map((r) => r.level);
}

describe('checkStoreDomain', () => {
  it('errors when blank', () => {
    expect(levels(checkStoreDomain(''))).toEqual(['error']);
    expect(levels(checkStoreDomain(undefined))).toEqual(['error']);
  });

  it('warns on a recognized placeholder', () => {
    expect(levels(checkStoreDomain('example-store.myshopify.com'))).toEqual(['warn']);
    expect(levels(checkStoreDomain('your-store.myshopify.com'))).toEqual(['warn']);
  });

  it('warns on a non-myshopify.com (custom) domain', () => {
    expect(levels(checkStoreDomain('www.my-cool-store.com'))).toEqual(['warn']);
  });

  it('is ok for a real permanent myshopify.com domain', () => {
    expect(levels(checkStoreDomain('acme-outfitters.myshopify.com'))).toEqual(['ok']);
  });
});

describe('checkStorefrontToken', () => {
  it('errors when blank', () => {
    expect(levels(checkStorefrontToken(''))).toEqual(['error']);
  });

  it('is ok when present', () => {
    expect(levels(checkStorefrontToken('a'.repeat(32)))).toEqual(['ok']);
  });
});

describe('checkApiVersion', () => {
  const now = new Date('2026-09-24T00:00:00Z');

  it('warns when blank (falls back to the compiled-in default)', () => {
    expect(levels(checkApiVersion('', now))).toEqual(['warn']);
  });

  it('errors on a malformed version', () => {
    expect(levels(checkApiVersion('2026-7', now))).toEqual(['error']);
    expect(levels(checkApiVersion('not-a-version', now))).toEqual(['error']);
    expect(levels(checkApiVersion('2026-13', now))).toEqual(['error']);
  });

  it('is ok for a current version', () => {
    expect(levels(checkApiVersion('2026-07', now))).toEqual(['ok']);
  });

  it('warns when more than ~12 months old', () => {
    expect(levels(checkApiVersion('2025-01', now))).toEqual(['warn']);
  });

  it('warns when far in the future', () => {
    expect(levels(checkApiVersion('2028-01', now))).toEqual(['warn']);
  });
});

describe('checkBundleId', () => {
  it('warns when blank', () => {
    expect(levels(checkBundleId(''))).toEqual(['warn']);
  });

  it('warns on the template default', () => {
    expect(levels(checkBundleId('com.example.storefront'))).toEqual(['warn']);
  });

  it('warns on a non reverse-DNS value', () => {
    expect(levels(checkBundleId('not-reverse-dns'))).toEqual(['warn']);
  });

  it('is ok for a real reverse-DNS id', () => {
    expect(levels(checkBundleId('com.acme.outfitters'))).toEqual(['ok']);
  });
});

describe('checkScheme', () => {
  it('warns when blank', () => {
    expect(levels(checkScheme(''))).toEqual(['warn']);
  });

  it('errors on an invalid scheme', () => {
    expect(levels(checkScheme('not a scheme!'))).toEqual(['error']);
    expect(levels(checkScheme('1notallowed'))).toEqual(['error']);
  });

  it('is ok for a valid scheme', () => {
    expect(levels(checkScheme('shopstore'))).toEqual(['ok']);
  });
});

describe('checkHexColor', () => {
  it('is ok when blank (uses default)', () => {
    expect(levels(checkHexColor('EXPO_PUBLIC_BRAND_PRIMARY', ''))).toEqual(['ok']);
  });

  it('warns on an invalid hex value', () => {
    expect(levels(checkHexColor('EXPO_PUBLIC_BRAND_PRIMARY', 'blue'))).toEqual(['warn']);
    expect(levels(checkHexColor('EXPO_PUBLIC_BRAND_PRIMARY', '#12'))).toEqual(['warn']);
  });

  it('is ok for #rgb and #rrggbb', () => {
    expect(levels(checkHexColor('EXPO_PUBLIC_BRAND_PRIMARY', '#fff'))).toEqual(['ok']);
    expect(levels(checkHexColor('EXPO_PUBLIC_BRAND_PRIMARY', '#0a7ea4'))).toEqual(['ok']);
  });
});

describe('checkColorScheme', () => {
  it.each(['light', 'dark', 'system', 'SYSTEM'])('is ok for %s', (value) => {
    expect(levels(checkColorScheme(value))).toEqual(['ok']);
  });

  it('warns on an invalid value', () => {
    expect(levels(checkColorScheme('purple'))).toEqual(['warn']);
  });
});

describe('checkCustomerAccounts', () => {
  it('is informational when both are blank', () => {
    expect(levels(checkCustomerAccounts('', ''))).toEqual(['info']);
  });

  it('errors on a malformed API URL and prints the callback URI when valid', () => {
    const bad = checkCustomerAccounts('https://shopify.com/wrong', 'client-1');
    expect(bad.some((r) => r.level === 'error')).toBe(true);

    const good = checkCustomerAccounts('https://shopify.com/authentication/12345', 'client-1');
    expect(good.some((r) => r.level === 'error')).toBe(false);
    const callout = good.find((r) => r.message.includes('callback'));
    expect(callout.message).toContain('shop.12345.app://callback');
  });

  it('warns when only one of the pair is set', () => {
    const onlyUrl = checkCustomerAccounts('https://shopify.com/authentication/12345', '');
    expect(onlyUrl.some((r) => r.level === 'warn' && r.key.includes('CLIENT_ID'))).toBe(true);

    const onlyClient = checkCustomerAccounts('', 'client-1');
    expect(onlyClient.some((r) => r.level === 'warn')).toBe(true);
  });
});

describe('checkHttpsUrl', () => {
  it('is informational when blank', () => {
    expect(levels(checkHttpsUrl('EXPO_PUBLIC_ABOUT_URL', ''))).toEqual(['info']);
  });

  it('warns on http (non-https)', () => {
    expect(levels(checkHttpsUrl('EXPO_PUBLIC_ABOUT_URL', 'http://example.com'))).toEqual(['warn']);
  });

  it('warns on an unparsable URL', () => {
    expect(levels(checkHttpsUrl('EXPO_PUBLIC_ABOUT_URL', 'not a url'))).toEqual(['warn']);
  });

  it('is ok for a valid https URL', () => {
    expect(levels(checkHttpsUrl('EXPO_PUBLIC_ABOUT_URL', 'https://example.com/about'))).toEqual(['ok']);
  });
});

describe('checkSupportEmail', () => {
  it('is informational when blank', () => {
    expect(levels(checkSupportEmail(''))).toEqual(['info']);
  });

  it('warns on a malformed email or one with CR/LF (header injection)', () => {
    expect(levels(checkSupportEmail('not-an-email'))).toEqual(['warn']);
    expect(levels(checkSupportEmail('a@example.com\r\nBcc:evil@example.com'))).toEqual(['warn']);
  });

  it('is ok for a valid email', () => {
    expect(levels(checkSupportEmail('support@example.com'))).toEqual(['ok']);
  });
});

describe('checkUniversalLinkDomains', () => {
  it('is informational when blank', () => {
    expect(levels(checkUniversalLinkDomains(''))).toEqual(['info']);
  });

  it('warns when an entry has a scheme or path', () => {
    expect(levels(checkUniversalLinkDomains('https://shop.example.com'))).toEqual(['warn']);
    expect(levels(checkUniversalLinkDomains('shop.example.com/path'))).toEqual(['warn']);
  });

  it('is ok for a comma list of bare hosts', () => {
    expect(levels(checkUniversalLinkDomains('shop.example.com, www.example.com'))).toEqual(['ok']);
  });
});

describe('checkOneSignalMode', () => {
  it('is ok when blank (defaults to development)', () => {
    expect(levels(checkOneSignalMode(''))).toEqual(['ok']);
  });

  it('warns on an invalid value', () => {
    expect(levels(checkOneSignalMode('prod'))).toEqual(['warn']);
  });

  it.each(['development', 'production'])('is ok for %s', (value) => {
    expect(levels(checkOneSignalMode(value))).toEqual(['ok']);
  });
});

describe('checkSentryDsn', () => {
  it('is informational when blank', () => {
    expect(levels(checkSentryDsn(''))).toEqual(['info']);
  });

  it('warns on a non-DSN-shaped value', () => {
    expect(levels(checkSentryDsn('not-a-url'))).toEqual(['warn']);
    expect(levels(checkSentryDsn('https://no-key-here.example.com'))).toEqual(['warn']);
  });

  it('is ok for a DSN-shaped URL', () => {
    expect(levels(checkSentryDsn('https://key@o123.ingest.sentry.io/456'))).toEqual(['ok']);
  });
});

describe('checkUnknownKeys', () => {
  it('flags EXPO_PUBLIC_* keys this template does not read', () => {
    const results = checkUnknownKeys(['EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN', 'EXPO_PUBLIC_TYPO_VAR']);
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('EXPO_PUBLIC_TYPO_VAR');
    expect(results[0].level).toBe('warn');
  });

  it('ignores non-EXPO_PUBLIC_ keys and known keys', () => {
    expect(checkUnknownKeys(['NODE_ENV', ...KNOWN_ENV_KEYS])).toHaveLength(0);
  });
});

describe('buildReport', () => {
  it('has errors and a non-empty result set for a blank/placeholder env', () => {
    const { results, hasErrors } = buildReport({
      EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'example-store.myshopify.com',
      EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: '',
    });
    expect(hasErrors).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('has no errors for a fully valid env', () => {
    const { hasErrors } = buildReport({
      EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'acme-outfitters.myshopify.com',
      EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'a'.repeat(32),
      EXPO_PUBLIC_SHOPIFY_API_VERSION: '2026-07',
      EXPO_PUBLIC_APP_BUNDLE_ID: 'com.acme.outfitters',
      EXPO_PUBLIC_APP_SCHEME: 'acmeoutfitters',
      EXPO_PUBLIC_BRAND_PRIMARY: '#0a7ea4',
      EXPO_PUBLIC_BRAND_ON_PRIMARY: '#ffffff',
      EXPO_PUBLIC_BRAND_SALE: '#d1453b',
      EXPO_PUBLIC_APP_BACKGROUND: '#ffffff',
      EXPO_PUBLIC_APP_COLOR_SCHEME: 'system',
    });
    expect(hasErrors).toBe(false);
  });

  it('warnings alone do not set hasErrors', () => {
    const { hasErrors, results } = buildReport({
      EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'acme-outfitters.myshopify.com',
      EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'a'.repeat(32),
      EXPO_PUBLIC_APP_BUNDLE_ID: 'com.example.storefront',
    });
    expect(results.some((r) => r.level === 'warn')).toBe(true);
    expect(hasErrors).toBe(false);
  });
});
