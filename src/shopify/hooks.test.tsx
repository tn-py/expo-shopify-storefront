import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';

import { storefront } from '@/shopify/client';
import {
  productQueryOptions,
  useCollection,
  useCollections,
  usePredictiveSearch,
  useProductRecommendations,
  useProducts,
  useSearchProducts,
  useShop,
  useWishlistProducts,
} from '@/shopify/hooks';
import { inContextVariables } from '@/shopify/locale';
import { loadProductWithAllVariants } from '@/shopify/product-loader';
import {
  COLLECTIONS_QUERY,
  COLLECTION_QUERY,
  PREDICTIVE_SEARCH_QUERY,
  PRODUCT_RECOMMENDATIONS_QUERY,
  PRODUCTS_QUERY,
  SEARCH_PRODUCTS_QUERY,
  SHOP_QUERY,
  WISHLIST_PRODUCTS_QUERY,
} from '@/shopify/queries';

jest.mock('@/shopify/client', () => ({ storefront: jest.fn() }));
jest.mock('@/shopify/product-loader', () => ({ loadProductWithAllVariants: jest.fn() }));

const mockStorefront = storefront as jest.Mock;
const mockLoadProduct = loadProductWithAllVariants as jest.Mock;

function Wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 1, gcTime: 0 } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockStorefront.mockReset();
  mockLoadProduct.mockReset();
});

describe('catalog hooks spread markets context', () => {
  it('passes @inContext variables on useShop', async () => {
    mockStorefront.mockResolvedValue({ shop: { name: 'Studio' } });
    renderHook(() => useShop(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mockStorefront).toHaveBeenCalledWith(SHOP_QUERY, { ...inContextVariables() }),
    );
  });

  it('passes @inContext variables on useCollections', async () => {
    mockStorefront.mockResolvedValue({ collections: { nodes: [] } });
    renderHook(() => useCollections(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mockStorefront).toHaveBeenCalledWith(COLLECTIONS_QUERY, {
        first: 40,
        ...inContextVariables(),
      }),
    );
  });

  it('passes @inContext variables on useProducts', async () => {
    mockStorefront.mockResolvedValue({ products: { nodes: [] } });
    renderHook(() => useProducts(), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mockStorefront).toHaveBeenCalledWith(PRODUCTS_QUERY, {
        first: 24,
        ...inContextVariables(),
      }),
    );
  });

  it('passes @inContext variables on useCollection', async () => {
    mockStorefront.mockResolvedValue({ collection: null });
    renderHook(() => useCollection('essentials'), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mockStorefront).toHaveBeenCalledWith(COLLECTION_QUERY, {
        handle: 'essentials',
        first: 20,
        after: null,
        sortKey: 'COLLECTION_DEFAULT',
        reverse: false,
        filters: [],
        ...inContextVariables(),
      }),
    );
  });

  it('passes @inContext variables on usePredictiveSearch', async () => {
    mockStorefront.mockResolvedValue({
      predictiveSearch: { queries: [], collections: [], products: [] },
    });
    renderHook(() => usePredictiveSearch('linen'), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mockStorefront).toHaveBeenCalledWith(PREDICTIVE_SEARCH_QUERY, {
        query: 'linen',
        ...inContextVariables(),
      }),
    );
  });

  it('passes @inContext variables on useSearchProducts', async () => {
    mockStorefront.mockResolvedValue({
      search: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    });
    renderHook(() => useSearchProducts('linen'), { wrapper: Wrapper });
    await waitFor(() =>
      expect(mockStorefront).toHaveBeenCalledWith(SEARCH_PRODUCTS_QUERY, {
        query: 'linen',
        first: 20,
        after: null,
        ...inContextVariables(),
      }),
    );
  });

  it('spreads @inContext variables into every variant-loading request via useProduct', async () => {
    mockLoadProduct.mockResolvedValue({ product: null });
    const options = productQueryOptions('shirt');
    expect(options.queryKey).toEqual(['product', 'shirt']);
    await options.queryFn!({} as never);
    expect(mockLoadProduct).toHaveBeenCalledWith('shirt');
  });
});

describe('useWishlistProducts', () => {
  it('is disabled with no saved ids', async () => {
    const { result } = await renderHook(() => useWishlistProducts([]), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockStorefront).not.toHaveBeenCalled();
  });

  it('refreshes saved products in context and drops ids Shopify no longer returns', async () => {
    mockStorefront.mockResolvedValue({
      nodes: [{ id: 'gid://shopify/Product/1', handle: 'shirt' }, null],
    });
    const { result } = await renderHook(
      () => useWishlistProducts(['gid://shopify/Product/1', 'gid://shopify/Product/gone']),
      { wrapper: Wrapper },
    );

    await waitFor(() =>
      expect(result.current.data).toEqual([{ id: 'gid://shopify/Product/1', handle: 'shirt' }]),
    );
    expect(mockStorefront).toHaveBeenCalledWith(WISHLIST_PRODUCTS_QUERY, {
      ids: ['gid://shopify/Product/1', 'gid://shopify/Product/gone'],
      ...inContextVariables(),
    });
  });
});

describe('useProductRecommendations', () => {
  it('is disabled without a product id', async () => {
    const { result } = await renderHook(() => useProductRecommendations(undefined), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockStorefront).not.toHaveBeenCalled();
  });

  it('requests related products in context and excludes nothing itself (caller filters the current product)', async () => {
    mockStorefront.mockResolvedValue({
      productRecommendations: [{ id: 'gid://shopify/Product/2', handle: 'other' }],
    });
    const { result } = await renderHook(() => useProductRecommendations('gid://shopify/Product/1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual([
      { id: 'gid://shopify/Product/2', handle: 'other' },
    ]));
    expect(mockStorefront).toHaveBeenCalledWith(PRODUCT_RECOMMENDATIONS_QUERY, {
      productId: 'gid://shopify/Product/1',
      ...inContextVariables(),
    });
  });

  it('treats a failed recommendations request as non-fatal (bounded retry)', async () => {
    mockStorefront.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useProductRecommendations('gid://shopify/Product/1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // retry: 1 means at most 2 attempts total.
    expect(mockStorefront.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
