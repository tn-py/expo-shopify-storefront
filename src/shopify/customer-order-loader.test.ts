import {
  loadCompleteOrder,
  type CustomerGraphqlRequester,
  type OrderDetail,
  type OrderFulfillment,
  type OrderLineItem,
} from './customer';

const money = { amount: '10.00', currencyCode: 'USD' };

function orderLine(index: number): OrderLineItem {
  return {
    id: `line-${index}`,
    title: `Item ${index}`,
    quantity: 1,
    totalPrice: money,
    image: null,
    variantId: `variant-${index}`,
    variantTitle: null,
    variantOptions: null,
  };
}

function fulfillment(index: number): OrderFulfillment {
  return {
    id: `fulfillment-${index}`,
    status: 'SUCCESS',
    latestShipmentStatus: null,
    estimatedDeliveryAt: null,
    trackingInformation: [],
  };
}

function detail(): OrderDetail {
  return {
    id: 'gid://shopify/Order/123',
    name: '#1001',
    processedAt: '2026-08-20T12:00:00Z',
    cancelledAt: null,
    financialStatus: 'PAID',
    fulfillmentStatus: 'FULFILLED',
    subtotal: money,
    totalPrice: money,
    totalShipping: money,
    totalTax: null,
    totalRefunded: { amount: '0.00', currencyCode: 'USD' },
    shippingAddress: null,
    lineItems: {
      edges: Array.from({ length: 50 }, (_, index) => ({ node: orderLine(index + 1) })),
      pageInfo: { hasNextPage: true, endCursor: 'line-50' },
    },
    fulfillments: {
      nodes: Array.from({ length: 10 }, (_, index) => fulfillment(index + 1)),
      pageInfo: { hasNextPage: true, endCursor: 'fulfillment-10' },
    },
  };
}

describe('loadCompleteOrder', () => {
  it('loads every line item and fulfillment beyond the initial API caps', async () => {
    const request = jest.fn(async (_getToken, query: string, variables) => {
      if (query.includes('query Order(')) return { order: detail() };
      if (query.includes('query OrderLineItemsPage')) {
        expect(variables).toEqual({ id: 'gid://shopify/Order/123', after: 'line-50' });
        return {
          order: {
            lineItems: {
              edges: Array.from({ length: 10 }, (_, index) => ({ node: orderLine(index + 51) })),
              pageInfo: { hasNextPage: false, endCursor: 'line-60' },
            },
          },
        };
      }
      if (query.includes('query OrderFulfillmentsPage')) {
        expect(variables).toEqual({ id: 'gid://shopify/Order/123', after: 'fulfillment-10' });
        return {
          order: {
            fulfillments: {
              nodes: [fulfillment(11), fulfillment(12)],
              pageInfo: { hasNextPage: false, endCursor: 'fulfillment-12' },
            },
          },
        };
      }
      throw new Error('Unexpected query');
    }) as CustomerGraphqlRequester;

    const order = await loadCompleteOrder(
      async () => 'access-token',
      'gid://shopify/Order/123',
      request,
    );

    expect(order?.lineItems.edges).toHaveLength(60);
    expect(order?.fulfillments.nodes).toHaveLength(12);
    expect(order?.lineItems.edges.at(-1)?.node.id).toBe('line-60');
    expect(order?.fulfillments.nodes.at(-1)?.id).toBe('fulfillment-12');
    expect(request).toHaveBeenCalledTimes(3);
  });
});
