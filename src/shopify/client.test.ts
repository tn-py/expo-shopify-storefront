let mockIsDemoStore = false;

const mockCreateStorefrontApiClient = jest.fn((..._args: unknown[]) => ({
  request: jest.fn().mockResolvedValue({ data: { shop: { name: 'Real Store' } } }),
}));

jest.mock('@shopify/storefront-api-client', () => ({
  createStorefrontApiClient: (...args: unknown[]) => mockCreateStorefrontApiClient(...args),
}));

jest.mock('./env', () => ({
  get isDemoStore() {
    return mockIsDemoStore;
  },
  ShopifyEnv: {
    storeDomain: 'a-real-store.myshopify.com',
    apiVersion: '2026-07',
    storefrontToken: 'token-value',
  },
}));

/** Re-imports the module under test so its module-scope lazy client resets. */
function loadClient(): typeof import('./client') {
  let mod!: typeof import('./client');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- re-import for a fresh lazy-client instance
    mod = require('./client');
  });
  return mod;
}

describe('stripInContextDirective', () => {
  it('removes the @inContext directive and its now-unused variable declarations', () => {
    const { stripInContextDirective } = loadClient();
    const operation = `
      query Product($handle: String!, $country: CountryCode, $language: LanguageCode)
        @inContext(country: $country, language: $language) {
        product(handle: $handle) { id }
      }
    `;
    const stripped = stripInContextDirective(operation);
    expect(stripped).not.toMatch(/@inContext/);
    expect(stripped).not.toMatch(/\$country/);
    expect(stripped).not.toMatch(/\$language/);
    expect(stripped).toMatch(/\$handle: String!/);
    expect(stripped).toMatch(/query Product\(\$handle: String!\)/);
  });

  it('leaves an operation with no @inContext directive unchanged', () => {
    const { stripInContextDirective } = loadClient();
    const operation = 'query Shop { shop { name } }';
    expect(stripInContextDirective(operation)).toBe(operation);
  });

  it('collapses to no parens at all when country/language were the only variables', () => {
    const { stripInContextDirective } = loadClient();
    const operation = `
      query Shop($country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
        shop { name }
      }
    `;
    const stripped = stripInContextDirective(operation);
    expect(stripped).toMatch(/query Shop\s*\{/);
    expect(stripped).not.toMatch(/\(\s*\)/);
  });

  it('handles country/language declared with a default value', () => {
    const { stripInContextDirective } = loadClient();
    const operation =
      'query Shop($country: CountryCode = null, $language: LanguageCode = null) @inContext(country: $country, language: $language) { shop { name } }';
    const stripped = stripInContextDirective(operation);
    expect(stripped).not.toMatch(/\$country/);
    expect(stripped).not.toMatch(/\$language/);
    expect(stripped).not.toMatch(/@inContext/);
  });

  it('handles country/language declared first, before other variables', () => {
    const { stripInContextDirective } = loadClient();
    const operation =
      'query Product($country: CountryCode, $language: LanguageCode, $handle: String!) @inContext(country: $country, language: $language) { product(handle: $handle) { id } }';
    const stripped = stripInContextDirective(operation);
    expect(stripped).toMatch(/query Product\(\$handle: String!\)/);
  });
});

describe('storefront() — configured store', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    mockIsDemoStore = false;
    mockCreateStorefrontApiClient.mockClear();
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('does not construct the real client at module import time', () => {
    loadClient();
    expect(mockCreateStorefrontApiClient).not.toHaveBeenCalled();
  });

  it('constructs the real client lazily, on the first real request', async () => {
    const { storefront } = loadClient();
    expect(mockCreateStorefrontApiClient).not.toHaveBeenCalled();

    await storefront('query Shop { shop { name } }');
    expect(mockCreateStorefrontApiClient).toHaveBeenCalledTimes(1);

    await storefront('query Shop { shop { name } }');
    expect(mockCreateStorefrontApiClient).toHaveBeenCalledTimes(1);
  });

  it('never touches fetch directly — requests go through the real client', async () => {
    const { storefront } = loadClient();
    await storefront('query Shop { shop { name } }');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('throws StorefrontError when the client returns no data', async () => {
    mockCreateStorefrontApiClient.mockReturnValueOnce({
      request: jest.fn().mockResolvedValue({ data: null, errors: { message: 'nope' } }),
    });
    const { storefront, StorefrontError } = loadClient();
    await expect(storefront('query Shop { shop { name } }')).rejects.toThrow(StorefrontError);
  });
});

describe('storefront() — demo mode (mock.shop)', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    mockIsDemoStore = true;
    mockCreateStorefrontApiClient.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('POSTs to mock.shop with a stripped query and no country/language variables', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { shop: { name: 'Demo Store' } } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { storefront } = loadClient();
    const operation =
      'query Shop($country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) { shop { name } }';
    const data = await storefront<{ shop: { name: string } }>(operation, {
      country: 'US',
      language: 'EN',
      first: 10,
    });

    expect(data).toEqual({ shop: { name: 'Demo Store' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://mock.shop/api');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });

    const body = JSON.parse(init.body as string);
    expect(body.query).not.toMatch(/@inContext/);
    expect(body.query).not.toMatch(/\$country/);
    expect(body.query).not.toMatch(/\$language/);
    expect(body.variables).toEqual({ first: 10 });
    expect(body.variables).not.toHaveProperty('country');
    expect(body.variables).not.toHaveProperty('language');
  });

  it('sends an empty variables object when none were passed', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { shop: { name: 'Demo Store' } } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { storefront } = loadClient();
    await storefront('query Shop { shop { name } }');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.variables).toEqual({});
  });

  it('never constructs the real Storefront API client', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { shop: { name: 'Demo Store' } } }),
    }) as unknown as typeof fetch;

    const { storefront } = loadClient();
    await storefront('query Shop { shop { name } }');
    expect(mockCreateStorefrontApiClient).not.toHaveBeenCalled();
  });

  it('throws StorefrontError on a non-OK HTTP response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const { storefront, StorefrontError } = loadClient();
    await expect(storefront('query Shop { shop { name } }')).rejects.toThrow(StorefrontError);
  });

  it('throws StorefrontError when fetch itself rejects (network failure)', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    const { storefront, StorefrontError } = loadClient();
    await expect(storefront('query Shop { shop { name } }')).rejects.toThrow(StorefrontError);
  });

  it('throws StorefrontError when mock.shop returns no data', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: { message: 'bad query' } }),
    }) as unknown as typeof fetch;

    const { storefront, StorefrontError } = loadClient();
    await expect(storefront('query Shop { shop { name } }')).rejects.toThrow(StorefrontError);
  });
});

describe('demo transport error normalization', () => {
  it('joins GraphQL error arrays into a StorefrontError message', async () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN = '';
    process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN = '';
    process.env.EXPO_PUBLIC_DEMO_MODE = '';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'Field x missing' }, { message: 'Bad y' }] }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { storefront, StorefrontError } = require('./client');
    await expect(storefront('query { shop { name } }')).rejects.toEqual(
      expect.objectContaining({ message: 'Field x missing; Bad y' }),
    );
    await expect(storefront('query { shop { name } }')).rejects.toBeInstanceOf(StorefrontError);
  });
});
