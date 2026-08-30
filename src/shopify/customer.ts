import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { customerQueryKey } from './customer-session';
import { ShopifyEnv } from './env';
import type { Money, ShopImage } from './types';

/** Calls the Customer Account GraphQL API with the current buyer token. */
export async function customerGraphql<TData>(
  getAccessToken: () => Promise<string | null>,
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const token = await getAccessToken();
  if (!token) throw new Error('Your session ended. Sign in again.');

  const res = await fetch(ShopifyEnv.customerAccountGraphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? 'Customer Account API error');
  }
  if (!json.data) throw new Error('Customer Account API returned no data');
  return json.data as TData;
}

export interface OrderLineItem {
  id: string;
  title: string;
  quantity: number;
  totalPrice: Money | null;
  image: ShopImage | null;
  variantId: string | null;
  variantTitle: string | null;
  variantOptions: { name: string; value: string }[] | null;
}

export interface OrderSummary {
  id: string;
  name: string;
  processedAt: string;
  cancelledAt: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string;
  totalPrice: Money;
  lineItems: {
    edges: { node: OrderLineItem }[];
    pageInfo?: PageInfo;
  };
}

export interface CustomerAddress {
  id: string;
  firstName: string | null;
  lastName: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  zoneCode: string | null;
  zip: string | null;
  territoryCode: string | null;
  phoneNumber: string | null;
  formatted: string[];
}

export interface OrderFulfillment {
  id: string;
  status: string | null;
  latestShipmentStatus: string | null;
  estimatedDeliveryAt: string | null;
  trackingInformation: {
    company: string | null;
    number: string | null;
    url: string | null;
  }[];
}

export interface OrderDetail extends Omit<OrderSummary, 'lineItems'> {
  subtotal: Money | null;
  totalShipping: Money;
  totalTax: Money | null;
  totalRefunded: Money;
  shippingAddress: CustomerAddress | null;
  lineItems: {
    edges: { node: OrderLineItem }[];
    pageInfo: PageInfo;
  };
  fulfillments: {
    nodes: OrderFulfillment[];
    pageInfo: PageInfo;
  };
}

const ORDER_LINE_FIELDS = `
  id title quantity variantId variantTitle
  variantOptions { name value }
  totalPrice { amount currencyCode }
  image { url altText width height }
`;

const ORDERS_QUERY = `
  query Orders($first: Int = 25, $after: String) {
    customer {
      orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id name processedAt cancelledAt financialStatus fulfillmentStatus
            totalPrice { amount currencyCode }
            lineItems(first: 3) { edges { node { ${ORDER_LINE_FIELDS} } } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const ORDER_QUERY = `
  query Order($id: ID!) {
    order(id: $id) {
      id name processedAt cancelledAt financialStatus fulfillmentStatus
      subtotal { amount currencyCode }
      totalPrice { amount currencyCode }
      totalShipping { amount currencyCode }
      totalTax { amount currencyCode }
      totalRefunded { amount currencyCode }
      shippingAddress {
        id firstName lastName address1 address2 city zoneCode zip territoryCode phoneNumber
        formatted(withName: true)
      }
      fulfillments(first: 10) {
        nodes {
          id status latestShipmentStatus estimatedDeliveryAt
          trackingInformation { company number url }
        }
        pageInfo { hasNextPage endCursor }
      }
      lineItems(first: 50) {
        edges { node { ${ORDER_LINE_FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const ORDER_LINE_ITEMS_PAGE_QUERY = `
  query OrderLineItemsPage($id: ID!, $after: String!) {
    order(id: $id) {
      lineItems(first: 50, after: $after) {
        edges { node { ${ORDER_LINE_FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const ORDER_FULFILLMENTS_PAGE_QUERY = `
  query OrderFulfillmentsPage($id: ID!, $after: String!) {
    order(id: $id) {
      fulfillments(first: 10, after: $after) {
        nodes {
          id status latestShipmentStatus estimatedDeliveryAt
          trackingInformation { company number url }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const ADDRESSES_QUERY = `
  query Addresses($first: Int = 25, $after: String) {
    customer {
      defaultAddress { id }
      addresses(first: $first, after: $after) {
        edges {
          node {
            id firstName lastName address1 address2 city zoneCode zip territoryCode phoneNumber
            formatted(withName: true)
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

type TokenGetter = () => Promise<string | null>;
type PageInfo = { hasNextPage: boolean; endCursor: string | null };
export type CustomerGraphqlRequester = <TData>(
  getAccessToken: TokenGetter,
  query: string,
  variables?: Record<string, unknown>,
) => Promise<TData>;

function requireNextCursor(
  pageInfo: PageInfo,
  connection: string,
  seen: Set<string>,
): string | null {
  if (!pageInfo.hasNextPage) return null;
  const cursor = pageInfo.endCursor;
  if (!cursor || seen.has(cursor)) {
    throw new Error(`Shopify returned an incomplete ${connection} connection.`);
  }
  seen.add(cursor);
  return cursor;
}

export async function loadCompleteOrder(
  getAccessToken: TokenGetter,
  id: string,
  request: CustomerGraphqlRequester = customerGraphql,
): Promise<OrderDetail | null> {
  const initial = await request<{ order: OrderDetail | null }>(
    getAccessToken,
    ORDER_QUERY,
    { id },
  );
  if (!initial.order) return null;

  const lineEdges = [...initial.order.lineItems.edges];
  const seenLineIds = new Set(lineEdges.map((edge) => edge.node.id));
  const lineCursors = new Set<string>();
  let linePageInfo = initial.order.lineItems.pageInfo;
  let lineCursor = requireNextCursor(linePageInfo, 'order line items', lineCursors);
  while (lineCursor) {
    const page = await request<{
      order: { lineItems: OrderDetail['lineItems'] } | null;
    }>(getAccessToken, ORDER_LINE_ITEMS_PAGE_QUERY, { id, after: lineCursor });
    if (!page.order) throw new Error('The order became unavailable while loading all line items.');
    for (const edge of page.order.lineItems.edges) {
      if (!seenLineIds.has(edge.node.id)) {
        seenLineIds.add(edge.node.id);
        lineEdges.push(edge);
      }
    }
    linePageInfo = page.order.lineItems.pageInfo;
    lineCursor = requireNextCursor(linePageInfo, 'order line items', lineCursors);
  }

  const fulfillments = [...initial.order.fulfillments.nodes];
  const seenFulfillmentIds = new Set(fulfillments.map((fulfillment) => fulfillment.id));
  const fulfillmentCursors = new Set<string>();
  let fulfillmentPageInfo = initial.order.fulfillments.pageInfo;
  let fulfillmentCursor = requireNextCursor(
    fulfillmentPageInfo,
    'order fulfillments',
    fulfillmentCursors,
  );
  while (fulfillmentCursor) {
    const page = await request<{
      order: { fulfillments: OrderDetail['fulfillments'] } | null;
    }>(getAccessToken, ORDER_FULFILLMENTS_PAGE_QUERY, { id, after: fulfillmentCursor });
    if (!page.order) throw new Error('The order became unavailable while loading all fulfillments.');
    for (const fulfillment of page.order.fulfillments.nodes) {
      if (!seenFulfillmentIds.has(fulfillment.id)) {
        seenFulfillmentIds.add(fulfillment.id);
        fulfillments.push(fulfillment);
      }
    }
    fulfillmentPageInfo = page.order.fulfillments.pageInfo;
    fulfillmentCursor = requireNextCursor(
      fulfillmentPageInfo,
      'order fulfillments',
      fulfillmentCursors,
    );
  }

  return {
    ...initial.order,
    lineItems: { edges: lineEdges, pageInfo: linePageInfo },
    fulfillments: { nodes: fulfillments, pageInfo: fulfillmentPageInfo },
  };
}

export function useOrders(getAccessToken: TokenGetter, sessionKey: string) {
  return useInfiniteQuery({
    queryKey: customerQueryKey(sessionKey, 'orders'),
    enabled: sessionKey.length > 0,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => customerGraphql<{
      customer: {
        orders: { edges: { node: OrderSummary }[]; pageInfo: PageInfo };
      };
    }>(getAccessToken, ORDERS_QUERY, { first: 25, after: pageParam }),
    getNextPageParam: (last) => last.customer.orders.pageInfo.hasNextPage
      ? last.customer.orders.pageInfo.endCursor
      : undefined,
  });
}

export function useOrder(getAccessToken: TokenGetter, sessionKey: string, id: string) {
  return useQuery({
    queryKey: customerQueryKey(sessionKey, 'order', id),
    enabled: sessionKey.length > 0 && id.length > 0,
    queryFn: () => loadCompleteOrder(getAccessToken, id),
  });
}

export function useAddresses(getAccessToken: TokenGetter, sessionKey: string) {
  return useInfiniteQuery({
    queryKey: customerQueryKey(sessionKey, 'addresses'),
    enabled: sessionKey.length > 0,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => customerGraphql<{
      customer: {
        defaultAddress: { id: string } | null;
        addresses: { edges: { node: CustomerAddress }[]; pageInfo: PageInfo };
      };
    }>(getAccessToken, ADDRESSES_QUERY, { first: 25, after: pageParam }),
    getNextPageParam: (last) => last.customer.addresses.pageInfo.hasNextPage
      ? last.customer.addresses.pageInfo.endCursor
      : undefined,
  });
}
