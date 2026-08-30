import {
  formatOrderDate,
  getOrderStatusPresentation,
  reorderLinesForOrder,
  safeDecodeOrderId,
} from './order-presentation';

describe('order presentation recovery', () => {
  it('rejects malformed and non-Shopify order route ids without throwing', () => {
    expect(safeDecodeOrderId('%E0%A4%A')).toBeNull();
    expect(safeDecodeOrderId('not-an-order')).toBeNull();
    expect(safeDecodeOrderId(encodeURIComponent('gid://shopify/Order/123')))
      .toBe('gid://shopify/Order/123');
  });

  it('uses an explicit fallback for malformed dates', () => {
    expect(formatOrderDate('not-a-date')).toBe('Date unavailable');
  });

  it.each([
    {
      name: 'pending', financialStatus: 'PENDING', fulfillmentStatus: 'UNFULFILLED',
      payment: ['Payment pending', 'warning'], fulfillment: ['Not fulfilled', 'neutral'],
    },
    {
      name: 'partial', financialStatus: 'PARTIALLY_PAID', fulfillmentStatus: 'PARTIALLY_FULFILLED',
      payment: ['Partially paid', 'warning'], fulfillment: ['Partially fulfilled', 'warning'],
    },
    {
      name: 'fulfilled', financialStatus: 'PAID', fulfillmentStatus: 'FULFILLED',
      payment: ['Paid', 'success'], fulfillment: ['Fulfilled', 'success'],
    },
    {
      name: 'cancelled', financialStatus: 'VOIDED', fulfillmentStatus: 'UNFULFILLED',
      cancelledAt: '2026-08-28T10:00:00Z',
      payment: ['Voided', 'danger'], fulfillment: ['Cancelled', 'danger'],
    },
    {
      name: 'refunded', financialStatus: 'REFUNDED', fulfillmentStatus: 'FULFILLED',
      payment: ['Refunded', 'neutral'], fulfillment: ['Fulfilled', 'success'],
    },
  ])('maps $name payment and fulfillment independently', ({
    financialStatus, fulfillmentStatus, cancelledAt, payment, fulfillment,
  }) => {
    const status = getOrderStatusPresentation({
      financialStatus,
      fulfillmentStatus,
      cancelledAt: cancelledAt ?? null,
    });

    expect([status.payment.label, status.payment.tone]).toEqual(payment);
    expect([status.fulfillment.label, status.fulfillment.tone]).toEqual(fulfillment);
  });

  it('builds reorder inputs only from merchandise that still has a variant id', () => {
    expect(reorderLinesForOrder([
      { variantId: 'gid://shopify/ProductVariant/1', quantity: 2 },
      { variantId: null, quantity: 1 },
      { variantId: 'gid://shopify/ProductVariant/2', quantity: 0 },
    ])).toEqual([{ variantId: 'gid://shopify/ProductVariant/1', quantity: 2 }]);
  });
});
