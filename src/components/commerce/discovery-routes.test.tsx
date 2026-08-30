import { act, fireEvent, render } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import SearchScreen from '@/app/(tabs)/search';
import ShopScreen from '@/app/(tabs)/shop';
import CollectionScreen from '@/app/collection/[handle]';
import ProductScreen from '@/app/product/[handle]';
import type { Product, ProductCard } from '@/shopify/types';

let mockRouteHandle = 'shirt';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ handle: mockRouteHandle }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/lib/analytics', () => ({ screen: jest.fn(), track: jest.fn() }));
jest.mock('@/shopify/hooks', () => ({
  useShop: jest.fn(),
  useCollections: jest.fn(),
  useProducts: jest.fn(),
  usePredictiveSearch: jest.fn(),
  useSearchProducts: jest.fn(),
  useProduct: jest.fn(),
  useCollection: jest.fn(),
}));
jest.mock('@/shopify/cart', () => ({ useCart: jest.fn() }));

const hooks = jest.requireMock('@/shopify/hooks') as {
  useShop: jest.Mock;
  useCollections: jest.Mock;
  useProducts: jest.Mock;
  usePredictiveSearch: jest.Mock;
  useSearchProducts: jest.Mock;
  useProduct: jest.Mock;
  useCollection: jest.Mock;
};
const cart = jest.requireMock('@/shopify/cart') as { useCart: jest.Mock };

const image = { url: 'https://example.com/item.jpg', altText: 'Item', width: 800, height: 800 };
const money = { amount: '20.00', currencyCode: 'USD' };
const productCard: ProductCard = {
  id: 'product-1',
  handle: 'shirt',
  title: 'Predictive shirt',
  vendor: 'Studio',
  featuredImage: image,
  priceRange: { minVariantPrice: money, maxVariantPrice: money },
  compareAtPriceRange: { minVariantPrice: money, maxVariantPrice: money },
  availableForSale: true,
};
const product: Product = {
  ...productCard,
  title: 'Everyday shirt',
  description: 'A long-lived shirt.',
  descriptionHtml: '<p>A long-lived shirt.</p>',
  images: { nodes: [image] },
  options: [{ id: 'default', name: 'Title', values: ['Default Title'] }],
  variants: {
    nodes: [
      {
        id: 'variant-1',
        title: 'Default Title',
        availableForSale: true,
        price: money,
        compareAtPrice: null,
        selectedOptions: [{ name: 'Title', value: 'Default Title' }],
        image,
        sku: 'SHIRT-1',
      },
    ],
    pageInfo: { hasNextPage: false, endCursor: null },
  },
  tags: [],
};

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    isError: false,
    isFetching: false,
    isRefetching: false,
    fetchStatus: 'idle',
    refetch: jest.fn(),
    ...overrides,
  };
}

function searchResult(overrides: Record<string, unknown> = {}) {
  return {
    ...queryResult(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteHandle = 'shirt';
  hooks.useShop.mockReturnValue(queryResult({ data: { name: 'Studio', brand: null } }));
  hooks.useCollections.mockReturnValue(queryResult({ data: [] }));
  hooks.useProducts.mockReturnValue(queryResult({ data: [] }));
  hooks.usePredictiveSearch.mockReturnValue(
    queryResult({ data: { products: [], collections: [], queries: [] } }),
  );
  hooks.useSearchProducts.mockReturnValue(searchResult());
  hooks.useProduct.mockReturnValue(queryResult({ data: product }));
  hooks.useCollection.mockReturnValue(
    searchResult({
      data: {
        pages: [
          {
            collection: {
              id: 'collection-1',
              handle: 'essentials',
              title: 'Essentials',
              description: 'Everyday goods.',
              image: null,
              products: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
                filters: [],
              },
            },
          },
        ],
      },
    }),
  );
  cart.useCart.mockReturnValue({ addLine: jest.fn(), busy: false });
});

describe('discovery route states', () => {
  it('shows a recoverable Home error when all Shopify merchandising requests fail', async () => {
    hooks.useCollections.mockReturnValue(queryResult({ isError: true, error: new Error('offline') }));
    hooks.useProducts.mockReturnValue(queryResult({ isError: true, error: new Error('offline') }));

    const { getByText, getByRole } = await render(<HomeScreen />);

    expect(getByText(/couldn’t load the storefront/i)).toBeOnTheScreen();
    expect(getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  it('keeps static Home merchandising and hides unavailable data-backed sections', async () => {
    const { getByText, queryByText } = await render(<HomeScreen />);

    expect(getByText('Designed for everyday living')).toBeOnTheScreen();
    expect(getByText('Shop with confidence')).toBeOnTheScreen();
    expect(queryByText('Featured products')).toBeNull();
    expect(queryByText('Shop by collection')).toBeNull();
  });

  it('presents an intentional empty Shop state', async () => {
    const { getByText } = await render(<ShopScreen />);

    expect(getByText('No collections yet')).toBeOnTheScreen();
  });

  it('hides Collection filters when Storefront returns no supported capabilities', async () => {
    mockRouteHandle = 'essentials';
    const { getByText, queryByText } = await render(<CollectionScreen />);

    expect(getByText('No products in this collection yet')).toBeOnTheScreen();
    expect(queryByText('Color')).toBeNull();
  });

  it('renders Collection not-found state intentionally', async () => {
    hooks.useCollection.mockReturnValue(
      searchResult({ data: { pages: [{ collection: null }] } }),
    );
    const { getByText } = await render(<CollectionScreen />);

    expect(getByText('Collection not found')).toBeOnTheScreen();
  });

  it('does not show predictive products after an authoritative empty search is submitted', async () => {
    hooks.usePredictiveSearch.mockReturnValue(
      queryResult({ data: { products: [productCard], collections: [], queries: [] } }),
    );
    hooks.useSearchProducts.mockImplementation((query: string) =>
      query
        ? searchResult({
            data: {
              pages: [
                { search: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
              ],
            },
          })
        : searchResult(),
    );
    const searchScreen = await render(<SearchScreen />);
    const { getByLabelText, getByText, queryByText } = searchScreen;

    const search = getByLabelText('Search products');
    await fireEvent.changeText(search, 'linen');
    expect(getByText('Predictive shirt')).toBeOnTheScreen();
    await fireEvent(search, 'submitEditing');
    expect(getByText('No matches')).toBeOnTheScreen();
    expect(queryByText('Predictive shirt')).toBeNull();
    searchScreen.unmount();
  });

  it('hides stale submitted pagination feedback while editing predictive suggestions', async () => {
    hooks.usePredictiveSearch.mockReturnValue(
      queryResult({ data: { products: [productCard], collections: [], queries: [] } }),
    );
    hooks.useSearchProducts.mockImplementation((query: string) =>
      query
        ? searchResult({
            isFetchNextPageError: true,
            data: {
              pages: [
                { search: { nodes: [productCard], pageInfo: { hasNextPage: true, endCursor: 'page-1' } } },
              ],
            },
          })
        : searchResult(),
    );
    const searchScreen = await render(<SearchScreen />);
    const { getByLabelText, getByText, queryByText } = searchScreen;
    const search = getByLabelText('Search products');

    await fireEvent.changeText(search, 'linen');
    await fireEvent(search, 'submitEditing');
    expect(getByText('Couldn’t load more results.')).toBeOnTheScreen();
    await fireEvent.changeText(search, 'linens');
    expect(queryByText('Couldn’t load more results.')).toBeNull();
    searchScreen.unmount();
  });

  it('keeps Product selection recoverable when add to cart fails', async () => {
    const addLine = jest.fn().mockRejectedValue(new Error('offline'));
    cart.useCart.mockReturnValue({ addLine, busy: false });
    const { getByRole, getByText } = await render(<ProductScreen />);

    await act(async () => {
      await fireEvent.press(getByRole('button', { name: 'Add to cart' }));
    });

    expect(getByText(/selection is still here/i)).toBeOnTheScreen();
    expect(getByRole('button', { name: 'Try adding again' })).toBeOnTheScreen();
  });

  it('selects and adds a variant merged from a later Storefront page', async () => {
    const laterVariant = {
      ...product.variants.nodes[0],
      id: 'variant-later',
      title: 'Purple',
      sku: 'SHIRT-PURPLE',
      selectedOptions: [{ name: 'Color', value: 'Purple' }],
    };
    hooks.useProduct.mockReturnValue(
      queryResult({
        data: {
          ...product,
          options: [{ id: 'color', name: 'Color', values: ['Red', 'Purple'] }],
          variants: {
            nodes: [
              {
                ...product.variants.nodes[0],
                selectedOptions: [{ name: 'Color', value: 'Red' }],
              },
              laterVariant,
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
    );
    const addLine = jest.fn().mockResolvedValue(undefined);
    cart.useCart.mockReturnValue({ addLine, busy: false });
    const { getByRole } = await render(<ProductScreen />);

    await fireEvent.press(getByRole('button', { name: 'Purple' }));
    await act(async () => {
      await fireEvent.press(getByRole('button', { name: 'Add to cart' }));
    });
    expect(addLine).toHaveBeenCalledWith('variant-later', 1);
  });

  it('shows a multiplied sticky total when quantity is greater than one', async () => {
    const { getByRole, getByText } = await render(<ProductScreen />);

    await fireEvent.press(getByRole('button', { name: 'Increase quantity' }));
    expect(getByText('2 items total')).toBeOnTheScreen();
    expect(getByText('$40.00')).toBeOnTheScreen();
  });

  it('renders Product loading state intentionally', async () => {
    hooks.useProduct.mockReturnValue(queryResult({ isPending: true }));
    const loading = await render(<ProductScreen />);
    expect(loading.getByText('Loading product…')).toBeOnTheScreen();
  });

  it('renders Product not-found state intentionally', async () => {
    hooks.useProduct.mockReturnValue(queryResult({ data: null }));
    const missing = await render(<ProductScreen />);
    expect(missing.getByText('Product not found')).toBeOnTheScreen();
  });
});
