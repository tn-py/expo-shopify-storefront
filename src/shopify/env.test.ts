/**
 * `process.env.EXPO_PUBLIC_*` is read at module-eval time, so each case
 * re-imports the module under a fresh `process.env` via `jest.isolateModules`.
 */

const ENV_KEYS = [
  'EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN',
  'EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN',
  'EXPO_PUBLIC_DEMO_MODE',
] as const;

function loadEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>): typeof import('./env') {
  const previous: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) previous[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, overrides);

  let mod!: typeof import('./env');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- re-import to re-run module-scope init under fresh env
    mod = require('./env');
  });

  for (const key of ENV_KEYS) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
  return mod;
}

describe('isDemoStore / isStorefrontUsable', () => {
  it('is demo mode when nothing is configured and DEMO_MODE is unset (default on)', () => {
    const env = loadEnv({});
    expect(env.isStorefrontConfigured).toBe(false);
    expect(env.isDemoStore).toBe(true);
    expect(env.isStorefrontUsable).toBe(true);
  });

  it('is demo mode when nothing is configured and DEMO_MODE is explicitly "on"', () => {
    const env = loadEnv({ EXPO_PUBLIC_DEMO_MODE: 'on' });
    expect(env.isDemoStore).toBe(true);
    expect(env.isStorefrontUsable).toBe(true);
  });

  it('is not demo mode when DEMO_MODE=off and nothing is configured', () => {
    const env = loadEnv({ EXPO_PUBLIC_DEMO_MODE: 'off' });
    expect(env.isStorefrontConfigured).toBe(false);
    expect(env.isDemoStore).toBe(false);
    expect(env.isStorefrontUsable).toBe(false);
  });

  it('DEMO_MODE=off is case-insensitive and tolerates whitespace', () => {
    const env = loadEnv({ EXPO_PUBLIC_DEMO_MODE: '  OFF  ' });
    expect(env.isDemoStore).toBe(false);
  });

  it('is never demo mode once the storefront is configured, regardless of DEMO_MODE', () => {
    const env = loadEnv({
      EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'a-real-store.myshopify.com',
      EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'token-value',
      EXPO_PUBLIC_DEMO_MODE: 'on',
    });
    expect(env.isStorefrontConfigured).toBe(true);
    expect(env.isDemoStore).toBe(false);
    expect(env.isStorefrontUsable).toBe(true);
  });

  it('treats a placeholder domain from .env.example as not configured', () => {
    const env = loadEnv({
      EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'example-store.myshopify.com',
      EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: 'token-value',
    });
    expect(env.isStorefrontConfigured).toBe(false);
    expect(env.isDemoStore).toBe(true);
  });

  it('a domain with no token still falls back to demo mode, not configured', () => {
    const env = loadEnv({ EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'a-real-store.myshopify.com' });
    expect(env.isStorefrontConfigured).toBe(false);
    expect(env.isDemoStore).toBe(true);
    expect(env.isStorefrontUsable).toBe(true);
  });
});
