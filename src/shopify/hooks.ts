import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
} from '@tanstack/react-query';

import { storefront } from './client';
import {
  COLLECTIONS_QUERY,
  COLLECTION_QUERY,
  PREDICTIVE_SEARCH_QUERY,
  PRODUCT_QUERY,
  SEARCH_PRODUCTS_QUERY,
  SHOP_QUERY,
} from './queries';
import type {
  CollectionCard,
  Connection,
  Product,
  ProductCard,
  ShopImage,
} from './types';

interface ShopResult {
  shop: {
    name: string;
    description: string | null;
    primaryDomain: { url: string };
    brand: {
      logo: { image: ShopImage | null } | null;
      colors: {
        primary: { background: string | null; foreground: string | null }[];
        secondary: { background: string | null; foreground: string | null }[];
      } | null;
    } | null;
  };
}

export function useShop() {
  return useQuery({
    queryKey: ['shop'],
    queryFn: () => storefront<ShopResult>(SHOP_QUERY),
    staleTime: 60 * 60 * 1000,
    select: (d) => d.shop,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () =>
      storefront<{ collections: { nodes: CollectionCard[] } }>(COLLECTIONS_QUERY, {
        first: 40,
      }),
    select: (d) => d.collections.nodes,
  });
}

type CollectionSort = 'COLLECTION_DEFAULT' | 'BEST_SELLING' | 'PRICE' | 'CREATED' | 'TITLE';

interface CollectionResult {
  collection:
    | (CollectionCard & { products: Connection<ProductCard> })
    | null;
}

export function useCollection(handle: string, sort: CollectionSort = 'COLLECTION_DEFAULT', reverse = false) {
  return useInfiniteQuery({
    queryKey: ['collection', handle, sort, reverse],
    queryFn: ({ pageParam }) =>
      storefront<CollectionResult>(COLLECTION_QUERY, {
        handle,
        first: 20,
        after: pageParam ?? null,
        sortKey: sort,
        reverse,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => {
      const info = last.collection?.products.pageInfo;
      return info?.hasNextPage ? info.endCursor : undefined;
    },
    enabled: handle.length > 0,
  });
}

export function useProduct(handle: string) {
  return useQuery({
    queryKey: ['product', handle],
    queryFn: () => storefront<{ product: Product | null }>(PRODUCT_QUERY, { handle }),
    select: (d) => d.product,
    enabled: handle.length > 0,
  });
}

interface PredictiveSearchResult {
  predictiveSearch: {
    queries: { text: string; styledText: string }[];
    collections: Pick<CollectionCard, 'id' | 'handle' | 'title' | 'image'>[];
    products: ProductCard[];
  };
}

export function usePredictiveSearch(query: string) {
  return useQuery({
    queryKey: ['predictiveSearch', query],
    queryFn: () =>
      storefront<PredictiveSearchResult>(PREDICTIVE_SEARCH_QUERY, { query }),
    select: (d) => d.predictiveSearch,
    enabled: query.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useSearchProducts(query: string) {
  return useInfiniteQuery({
    queryKey: ['searchProducts', query],
    queryFn: ({ pageParam }) =>
      storefront<{ search: Connection<ProductCard> }>(SEARCH_PRODUCTS_QUERY, {
        query,
        first: 20,
        after: pageParam ?? null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.search.pageInfo.hasNextPage ? last.search.pageInfo.endCursor : undefined,
    enabled: query.trim().length >= 2,
  });
}
