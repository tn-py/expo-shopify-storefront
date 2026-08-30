import type { StatusBadgeProps } from '@/components/ui/status-badge';

type Badge = Required<Pick<StatusBadgeProps, 'label' | 'tone'>>;

export interface OrderStatusInput {
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: string | null;
}

export interface OrderStatusPresentation {
  payment: Badge;
  fulfillment: Badge;
}

const paymentStatuses: Record<string, Badge> = {
  AUTHORIZED: { label: 'Authorized', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  PARTIALLY_PAID: { label: 'Partially paid', tone: 'warning' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', tone: 'warning' },
  PENDING: { label: 'Payment pending', tone: 'warning' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  VOIDED: { label: 'Voided', tone: 'danger' },
};

const fulfillmentStatuses: Record<string, Badge> = {
  FULFILLED: { label: 'Fulfilled', tone: 'success' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning' },
  ON_HOLD: { label: 'On hold', tone: 'warning' },
  OPEN: { label: 'Not fulfilled', tone: 'neutral' },
  PARTIALLY_FULFILLED: { label: 'Partially fulfilled', tone: 'warning' },
  PENDING_FULFILLMENT: { label: 'Pending fulfillment', tone: 'warning' },
  RESTOCKED: { label: 'Restocked', tone: 'neutral' },
  SCHEDULED: { label: 'Scheduled', tone: 'warning' },
  UNFULFILLED: { label: 'Not fulfilled', tone: 'neutral' },
};

export function getOrderStatusPresentation(input: OrderStatusInput): OrderStatusPresentation {
  return {
    payment: input.financialStatus
      ? paymentStatuses[input.financialStatus] ?? { label: humanizeStatus(input.financialStatus), tone: 'neutral' }
      : { label: 'Payment status unavailable', tone: 'neutral' },
    fulfillment: input.cancelledAt
      ? { label: 'Cancelled', tone: 'danger' }
      : input.fulfillmentStatus
        ? fulfillmentStatuses[input.fulfillmentStatus] ?? { label: humanizeStatus(input.fulfillmentStatus), tone: 'neutral' }
        : { label: 'Fulfillment status unavailable', tone: 'neutral' },
  };
}

export function humanizeStatus(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

export function safeDecodeOrderId(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    return /^gid:\/\/shopify\/Order\/[^/]+$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function formatOrderDate(
  iso: string | null | undefined,
  style: 'short' | 'long' = 'short',
): string {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, style === 'long'
    ? { month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

export function reorderLinesForOrder(
  lines: { variantId: string | null; quantity: number }[],
): { variantId: string; quantity: number }[] {
  return lines.flatMap((line) =>
    line.variantId && line.quantity > 0
      ? [{ variantId: line.variantId, quantity: line.quantity }]
      : [],
  );
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
