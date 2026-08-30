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
  lineItems: { edges: { node: OrderLineItem }[] };
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

export interface OrderDetail extends OrderSummary {
  subtotal: Money | null;
  totalShipping: Money;
  totalTax: Money | null;
  totalRefunded: Money;
  shippingAddress: CustomerAddress | null;
  fulfillments: { nodes: OrderFulfillment[] };
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
      }
      lineItems(first: 50) { edges { node { ${ORDER_LINE_FIELDS} } } }
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
    queryFn: () => customerGraphql<{ order: OrderDetail | null }>(
      getAccessToken,
      ORDER_QUERY,
      { id },
    ),
    select: (data) => data.order,
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
