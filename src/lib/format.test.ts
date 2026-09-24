import { formatMoney, formatMoneyRange, isOnSale } from '@/lib/format';

let mockLocaleTag = 'en-US';

jest.mock('@/shopify/locale', () => ({
  deviceLocaleTag: () => mockLocaleTag,
}));

describe('formatMoney', () => {
  beforeEach(() => {
    mockLocaleTag = 'en-US';
  });

  it('formats using the device locale', () => {
    expect(formatMoney({ amount: '10', currencyCode: 'USD' })).toBe('$10.00');
  });

  it('re-formats for a different device locale (e.g. currency symbol placement)', () => {
    mockLocaleTag = 'de-DE';
    expect(formatMoney({ amount: '10', currencyCode: 'EUR' })).toBe('10,00 €');
  });

  it('returns an empty string for missing or invalid money', () => {
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(undefined)).toBe('');
    expect(formatMoney({ amount: 'not-a-number', currencyCode: 'USD' })).toBe('');
  });
});

describe('formatMoneyRange', () => {
  beforeEach(() => {
    mockLocaleTag = 'en-US';
  });

  it('collapses to a single price when min and max match', () => {
    const price = { amount: '25', currencyCode: 'USD' };
    expect(formatMoneyRange(price, price)).toBe('$25.00');
  });

  it('shows both ends of the range when they differ', () => {
    expect(
      formatMoneyRange(
        { amount: '10', currencyCode: 'USD' },
        { amount: '25', currencyCode: 'USD' },
      ),
    ).toBe('$10.00 – $25.00');
  });
});

describe('isOnSale', () => {
  it('is true only when compareAt exceeds the current price', () => {
    expect(
      isOnSale({ amount: '10', currencyCode: 'USD' }, { amount: '20', currencyCode: 'USD' }),
    ).toBe(true);
    expect(
      isOnSale({ amount: '20', currencyCode: 'USD' }, { amount: '20', currencyCode: 'USD' }),
    ).toBe(false);
  });

  it('is false when either price is missing', () => {
    expect(isOnSale(null, { amount: '20', currencyCode: 'USD' })).toBe(false);
    expect(isOnSale({ amount: '10', currencyCode: 'USD' }, undefined)).toBe(false);
  });
});
