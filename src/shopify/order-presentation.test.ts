import {
  addReorderLines,
  formatOrderDate,
  getOrderStatusPresentation,
  reorderLinesForOrder,
  safeDecodeOrderId,
  safeTrackingUrl,
} from './order-presentation';

describe('order presentation recovery', () => {
  it('rejects malformed and non-Shopify order route ids without throwing', () => {
    expect(safeDecodeOrderId('%E0%A4%A')).toBeNull();
    expect(safeDecodeOrderId('not-an-order')).toBeNull();
    expect(safeDecodeOrderId('gid://shopify/Order/123')).toBe('gid://shopify/Order/123');
    expect(safeDecodeOrderId(encodeURIComponent('gid://shopify/Order/123')))
      .toBe('gid://shopify/Order/123');
  });

  it.each([
    'gid://shopify/Order/123 ',
    'gid://shopify/Order/ 123',
    'gid://shopify/Order/123?preview=true',
    'gid://shopify/Order/123#shipment',
    'gid://shopify/Order/123\nBcc:attacker@example.com',
    'gid://shopify/Order/123/extra',
    'gid://shopify/Order/not-numeric',
    'gid://shopify/Order/0',
  ])('rejects a non-terminal Shopify order GID: %s', (id) => {
    expect(safeDecodeOrderId(encodeURIComponent(id))).toBeNull();
  });

  it('uses an explicit fallback for malformed dates', () => {
    expect(formatOrderDate('not-a-date')).toBe('Date unavailable');
  });

  it('keeps tracking links restricted to HTTP(S) with an explicitly named policy', () => {
    expect(safeTrackingUrl('http://carrier.example.com/track/123'))
      .toBe('http://carrier.example.com/track/123');
    expect(safeTrackingUrl('https://carrier.example.com/track/123'))
      .toBe('https://carrier.example.com/track/123');
    expect(safeTrackingUrl('javascript:alert(1)')).toBeNull();
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

  it('retries only the failed and remaining reorder inputs after partial success', async () => {
    const lines = [
      { variantId: 'gid://shopify/ProductVariant/1', quantity: 1 },
      { variantId: 'gid://shopify/ProductVariant/2', quantity: 2 },
      { variantId: 'gid://shopify/ProductVariant/3', quantity: 3 },
    ];
    let secondVariantAttempts = 0;
    const addLine = jest.fn(async (variantId: string) => {
      if (variantId.endsWith('/2') && secondVariantAttempts++ === 0) throw new Error('offline');
    });

    const first = await addReorderLines(lines, addLine);
    expect(first).toEqual({
      addedCount: 1,
      remaining: lines.slice(1),
    });
    const retry = await addReorderLines(first.remaining, addLine);

    expect(retry).toEqual({ addedCount: 2, remaining: [] });
    expect(addLine.mock.calls.map(([variantId]) => variantId)).toEqual([
      'gid://shopify/ProductVariant/1',
      'gid://shopify/ProductVariant/2',
      'gid://shopify/ProductVariant/2',
      'gid://shopify/ProductVariant/3',
    ]);
  });
});
