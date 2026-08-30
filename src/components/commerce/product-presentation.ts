import { Spacing } from '@/constants/theme';

export function getProductScrollBottomPadding(stickyActionHeight: number): number {
  return Math.max(0, stickyActionHeight) + Spacing.four;
}

function multiplyIntegerString(digits: string, multiplier: number): string {
  let carry = 0;
  let result = '';

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const value = Number(digits[index]) * multiplier + carry;
    result = `${value % 10}${result}`;
    carry = Math.floor(value / 10);
  }

  return `${carry || ''}${result}`.replace(/^0+(?=\d)/, '');
}

/** Multiply a Storefront decimal string while preserving its original precision. */
export function multiplyMoneyAmount(amount: string, quantity: number): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  const multiplier = Math.max(0, Math.floor(quantity));
  if (!match || !Number.isSafeInteger(multiplier)) return amount;

  const fraction = match[2] ?? '';
  const product = multiplyIntegerString(`${match[1]}${fraction}`, multiplier);
  if (!fraction.length) return product;

  const padded = product.padStart(fraction.length + 1, '0');
  return `${padded.slice(0, -fraction.length)}.${padded.slice(-fraction.length)}`;
}
