import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { ShopifyEnv } from './env';
import type { Money } from './types';

/**
 * Calls the Customer Account GraphQL API with the current customer's access
 * token (refreshed if needed). Throws on network / GraphQL errors.
 */
export async function customerGraphql<TData>(
  getAccessToken: () => Promise<string | null>,
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not signed in');

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

/* ---------- types ---------- */

export interface OrderSummary {
  id: string;
  name: string;
  processedAt: string;
  financialStatus: string | null;
  totalPrice: Money;
  lineItems: { edges: { node: { title: string; quantity: number } }[] };
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
}

export interface OrderDetail extends OrderSummary {
  lineItems: {
    edges: {
      node: {
        title: string;
        quantity: number;
        totalPrice: Money | null;
      };
    }[];
  };
  shippingAddress: CustomerAddress | null;
}

/* ---------- queries ---------- */

const ORDERS_QUERY = `
  query Orders($first: Int = 25, $after: String) {
    customer {
      orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            name
            processedAt
            financialStatus
            totalPrice { amount currencyCode }
            lineItems(first: 3) {
              edges { node { title quantity } }
            }
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
      id
      name
      processedAt
      financialStatus
      totalPrice { amount currencyCode }
      shippingAddress {
        id firstName lastName address1 address2 city zoneCode zip territoryCode phoneNumber
      }
      lineItems(first: 50) {
        edges {
          node {
            title
            quantity
            totalPrice { amount currencyCode }
          }
        }
      }
    }
  }
`;

const ADDRESSES_QUERY = `
  query Addresses {
    customer {
      defaultAddress { id }
      addresses(first: 25) {
        edges {
          node {
            id firstName lastName address1 address2 city zoneCode zip territoryCode phoneNumber
          }
        }
      }
    }
  }
`;

/* ---------- hooks ---------- */

type TokenGetter = () => Promise<string | null>;

export function useOrders(getAccessToken: TokenGetter, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['customer', 'orders'],
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      customerGraphql<{
        customer: {
          orders: {
            edges: { node: OrderSummary }[];
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        };
      }>(getAccessToken, ORDERS_QUERY, { first: 25, after: pageParam }),
    getNextPageParam: (last) =>
      last.customer.orders.pageInfo.hasNextPage
        ? last.customer.orders.pageInfo.endCursor
        : undefined,
  });
}

export function useOrder(getAccessToken: TokenGetter, id: string) {
  return useQuery({
    queryKey: ['customer', 'order', id],
    enabled: id.length > 0,
    queryFn: () =>
      customerGraphql<{ order: OrderDetail | null }>(getAccessToken, ORDER_QUERY, {
        id,
      }),
    select: (d) => d.order,
  });
}

export function useAddresses(getAccessToken: TokenGetter, enabled: boolean) {
  return useQuery({
    queryKey: ['customer', 'addresses'],
    enabled,
    queryFn: () =>
      customerGraphql<{
        customer: {
          defaultAddress: { id: string } | null;
          addresses: { edges: { node: CustomerAddress }[] };
        };
      }>(getAccessToken, ADDRESSES_QUERY),
    select: (d) => ({
      defaultId: d.customer.defaultAddress?.id ?? null,
      addresses: d.customer.addresses.edges.map((e) => e.node),
    }),
  });
}
