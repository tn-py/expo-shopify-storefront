import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import { storefront } from './client';
import { inContextVariables } from './locale';
import { loadProductWithAllVariants } from './product-loader';
import {
  COLLECTIONS_QUERY,
  COLLECTION_QUERY,
  PREDICTIVE_SEARCH_QUERY,
  PRODUCT_RECOMMENDATIONS_QUERY,
  PRODUCTS_QUERY,
  SEARCH_PRODUCTS_QUERY,
  SHOP_QUERY,
  WISHLIST_PRODUCTS_QUERY,
} from './queries';
import type {
  CollectionCard,
  CollectionSortKey,
  Connection,
  Product,
  ProductCard,
  ProductConnection,
  ProductFilterInput,
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
    queryFn: () => storefront<ShopResult>(SHOP_QUERY, { ...inContextVariables() }),
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
        ...inContextVariables(),
      }),
    select: (d) => d.collections.nodes,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ['products', 'featured'],
    queryFn: () =>
      storefront<{ products: { nodes: ProductCard[] } }>(PRODUCTS_QUERY, {
        first: 24,
        ...inContextVariables(),
      }),
    select: (data) => data.products.nodes,
  });
}

interface CollectionResult {
  collection:
    | (CollectionCard & { products: ProductConnection<ProductCard> })
    | null;
}

export function useCollection(
  handle: string,
  sort: CollectionSortKey = 'COLLECTION_DEFAULT',
  reverse = false,
  filters: ProductFilterInput[] = [],
) {
  return useInfiniteQuery({
    queryKey: ['collection', handle, sort, reverse, filters],
    queryFn: ({ pageParam }) =>
      storefront<CollectionResult>(COLLECTION_QUERY, {
        handle,
        first: 20,
        after: pageParam ?? null,
        sortKey: sort,
        reverse,
        filters,
        ...inContextVariables(),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => {
      const info = last.collection?.products.pageInfo;
      return info?.hasNextPage ? info.endCursor : undefined;
    },
    enabled: handle.length > 0,
  });
}

interface ProductResult {
  product: Product | null;
}

/**
 * Shared `useProduct` query definition, also used to prefetch a product (e.g.
 * from `ProductCard.onPressIn`) via `queryClient.prefetchQuery(productQueryOptions(handle))`.
 */
export function productQueryOptions(handle: string) {
  return queryOptions({
    queryKey: ['product', handle],
    queryFn: (): Promise<ProductResult> => loadProductWithAllVariants(handle),
    enabled: handle.length > 0,
  });
}

export function useProduct(handle: string) {
  return useQuery({
    ...productQueryOptions(handle),
    select: (d) => d.product,
  });
}

interface ProductRecommendationsResult {
  productRecommendations: ProductCard[] | null;
}

/** Related products for the PDP's "You may also like" rail. Errors are non-fatal. */
export function useProductRecommendations(productId: string | undefined) {
  return useQuery({
    queryKey: ['productRecommendations', productId],
    queryFn: () =>
      storefront<ProductRecommendationsResult>(PRODUCT_RECOMMENDATIONS_QUERY, {
        productId,
        ...inContextVariables(),
      }),
    select: (d) => d.productRecommendations ?? [],
    enabled: Boolean(productId),
    retry: 1,
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
      storefront<PredictiveSearchResult>(PREDICTIVE_SEARCH_QUERY, {
        query,
        ...inContextVariables(),
      }),
    select: (d) => d.predictiveSearch,
    enabled: query.trim().length >= 2,
  });
}

interface WishlistProductsResult {
  nodes: (ProductCard | null)[];
}

/** Refreshes saved items from Shopify — drops ids the store no longer returns a Product for. */
export function useWishlistProducts(ids: string[]) {
  return useQuery({
    queryKey: ['wishlistProducts', ids],
    queryFn: () =>
      storefront<WishlistProductsResult>(WISHLIST_PRODUCTS_QUERY, {
        ids,
        ...inContextVariables(),
      }),
    select: (d) => d.nodes.filter((node): node is ProductCard => node != null),
    enabled: ids.length > 0,
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
        ...inContextVariables(),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.search.pageInfo.hasNextPage ? last.search.pageInfo.endCursor : undefined,
    enabled: query.trim().length >= 2,
  });
}
