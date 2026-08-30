import {
  getProductScrollBottomPadding,
  multiplyMoneyAmount,
} from '@/components/commerce/product-presentation';

describe('product presentation helpers', () => {
  it('derives scroll clearance from the measured sticky action height', () => {
    expect(getProductScrollBottomPadding(80)).toBe(104);
    expect(getProductScrollBottomPadding(160)).toBe(184);
  });

  it('multiplies Shopify decimal money amounts without losing display precision', () => {
    expect(multiplyMoneyAmount('19.99', 3)).toBe('59.97');
    expect(multiplyMoneyAmount('20.00', 2)).toBe('40.00');
  });
});
