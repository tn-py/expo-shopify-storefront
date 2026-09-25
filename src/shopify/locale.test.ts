let mockLocale: { languageTag: string; languageCode: string | null; regionCode: string | null } = {
  languageTag: 'en-US',
  languageCode: 'en',
  regionCode: 'US',
};
let mockCountry = '';
let mockLanguage = '';
let mockLocalize = 'device';

jest.mock('expo-localization', () => ({
  getLocales: () => [mockLocale],
}));
jest.mock('@/shopify/env', () => ({
  ShopifyEnv: {
    get country() { return mockCountry; },
    get language() { return mockLanguage; },
    get localize() { return mockLocalize; },
  },
}));

/** Re-imports the module so its module-scope `storefrontLocale` picks up the mocks above. */
function loadLocale(): typeof import('./locale') {
  let mod!: typeof import('./locale');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- re-import to re-run module-scope init under fresh mocks
    mod = require('./locale');
  });
  return mod;
}

describe('storefrontLocale', () => {
  beforeEach(() => {
    mockLocale = { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' };
    mockCountry = '';
    mockLanguage = '';
    mockLocalize = 'device';
  });

  it('derives country and language from the device locale by default', () => {
    mockLocale = { languageTag: 'fr-CA', languageCode: 'fr', regionCode: 'CA' };
    expect(loadLocale().storefrontLocale).toEqual({ country: 'CA', language: 'FR' });
  });

  it('prefers valid env overrides over the device locale', () => {
    mockCountry = 'gb';
    mockLanguage = 'en';
    expect(loadLocale().storefrontLocale).toEqual({ country: 'GB', language: 'EN' });
  });

  it('falls back to the device locale when an override is malformed', () => {
    mockCountry = 'not-a-country';
    expect(loadLocale().storefrontLocale).toEqual({ country: 'US', language: 'EN' });
  });

  it('falls back to US/EN when neither an override nor the device locale is usable', () => {
    mockLocale = { languageTag: '', languageCode: null, regionCode: null };
    expect(loadLocale().storefrontLocale).toEqual({ country: 'US', language: 'EN' });
  });

  it('is null when localization is turned off, regardless of overrides', () => {
    mockLocalize = 'off';
    mockCountry = 'gb';
    expect(loadLocale().storefrontLocale).toBeNull();
  });
});

describe('deviceLocaleTag', () => {
  beforeEach(() => {
    mockLocale = { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' };
  });

  it('returns the device BCP-47 tag', () => {
    mockLocale = { languageTag: 'es-419', languageCode: 'es', regionCode: null };
    expect(loadLocale().deviceLocaleTag()).toBe('es-419');
  });

  it('falls back to en-US when the device has no language tag', () => {
    mockLocale = { languageTag: '', languageCode: null, regionCode: null };
    expect(loadLocale().deviceLocaleTag()).toBe('en-US');
  });
});
