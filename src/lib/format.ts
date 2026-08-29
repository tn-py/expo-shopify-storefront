import type { Money } from '@/shopify/types';

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currencyCode: string): Intl.NumberFormat {
  let f = formatters.get(currencyCode);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
    });
    formatters.set(currencyCode, f);
  }
  return f;
}

export function formatMoney(money: Money | null | undefined): string {
  if (!money) return '';
  const value = Number(money.amount);
  if (Number.isNaN(value)) return '';
  return formatterFor(money.currencyCode).format(value);
}

/** "$10.00 – $25.00" when the range spans, otherwise a single price. */
export function formatMoneyRange(min: Money, max: Money): string {
  const lo = formatMoney(min);
  if (min.amount === max.amount) return lo;
  return `${lo} – ${formatMoney(max)}`;
}

export function isOnSale(
  price: Money | null | undefined,
  compareAt: Money | null | undefined,
): boolean {
  if (!price || !compareAt) return false;
  return Number(compareAt.amount) > Number(price.amount);
}
