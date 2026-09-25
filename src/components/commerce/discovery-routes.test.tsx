import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render as baseRender } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import SearchScreen from '@/app/(tabs)/search';
import ShopScreen from '@/app/(tabs)/shop';
import CollectionScreen from '@/app/collection/[handle]';
import ProductScreen from '@/app/product/[handle]';
import type { Product, ProductCard } from '@/shopify/types';

let mockRouteHandle = 'shirt';
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ handle: mockRouteHandle }),
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
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
  useProductRecommendations: jest.fn(),
  productQueryOptions: (handle: string) => ({
    queryKey: ['product', handle],
    queryFn: async () => ({ product: null }),
  }),
}));
jest.mock('@/shopify/cart', () => ({ useCart: jest.fn() }));
jest.mock('@/wishlist/wishlist', () => ({ useWishlist: jest.fn() }));

const hooks = jest.requireMock('@/shopify/hooks') as {
  useShop: jest.Mock;
  useCollections: jest.Mock;
  useProducts: jest.Mock;
  usePredictiveSearch: jest.Mock;
  useSearchProducts: jest.Mock;
  useProduct: jest.Mock;
  useCollection: jest.Mock;
  useProductRecommendations: jest.Mock;
};
const cart = jest.requireMock('@/shopify/cart') as { useCart: jest.Mock };
const wishlist = jest.requireMock('@/wishlist/wishlist') as { useWishlist: jest.Mock };

/** Every screen here can render `ProductCard`, which prefetches via `useQueryClient()`. */
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return baseRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

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
  id: 'gid://shopify/Product/1',
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
  hooks.useShop.mockReturnValue(queryResult({ data: { name: 'Studio', brand: null, primaryDomain: { url: 'https://shop.example' } } }));
  hooks.useCollections.mockReturnValue(queryResult({ data: [] }));
  hooks.useProducts.mockReturnValue(queryResult({ data: [] }));
  hooks.usePredictiveSearch.mockReturnValue(
    queryResult({ data: { products: [], collections: [], queries: [] } }),
  );
  hooks.useSearchProducts.mockReturnValue(searchResult());
  hooks.useProduct.mockReturnValue(queryResult({ data: product }));
  hooks.useProductRecommendations.mockReturnValue(queryResult({ data: [] }));
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
  cart.useCart.mockReturnValue({ addLine: jest.fn(), busy: false, operations: {} });
  wishlist.useWishlist.mockReturnValue({
    items: [],
    ready: true,
    isSaved: () => false,
    toggle: jest.fn(),
    remove: jest.fn(),
  });
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

  it('links the Home saved-items entry point to /saved with the saved count in its label', async () => {
    wishlist.useWishlist.mockReturnValue({
      items: [productCard],
      ready: true,
      isSaved: () => true,
      toggle: jest.fn(),
      remove: jest.fn(),
    });
    const { getByRole } = await render(<HomeScreen />);

    const savedButton = getByRole('button', { name: 'Saved items, 1 saved' });
    await fireEvent.press(savedButton);
    expect(mockRouterPush).toHaveBeenCalledWith('/saved');
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

  it('shows recent searches as chips on the idle state, submits on tap, and clears', async () => {
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['linen']));
    hooks.useSearchProducts.mockImplementation((query: string) =>
      query
        ? searchResult({ data: { pages: [{ search: { nodes: [productCard], pageInfo: { hasNextPage: false, endCursor: null } } }] } })
        : searchResult(),
    );

    const searchScreen = await render(<SearchScreen />);
    const { findByText, getByRole, queryByText } = searchScreen;

    const chip = await findByText('linen');
    await fireEvent.press(chip);
    expect(await findByText('Predictive shirt')).toBeOnTheScreen();

    // Back out to the idle state so the recent-searches "Clear" action is the only one showing.
    await fireEvent.press(getByRole('button', { name: 'Clear' }));
    expect(await findByText('linen')).toBeOnTheScreen();
    await fireEvent.press(getByRole('button', { name: 'Clear' }));
    expect(queryByText('linen')).toBeNull();
    searchScreen.unmount();
  });

  it('keeps Product selection recoverable when add to cart fails', async () => {
    const addLine = jest.fn().mockRejectedValue(new Error('offline'));
    cart.useCart.mockReturnValue({ addLine, busy: false, operations: {} });
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
    cart.useCart.mockReturnValue({ addLine, busy: false, operations: {} });
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

  it('uses the add-operation pending state (not the global busy flag) for the Add to cart button', async () => {
    const addLine = jest.fn().mockResolvedValue(undefined);
    // `busy: true` here would be wrong to key off — a different in-flight
    // operation (e.g. a line update) must not spin the Add button.
    cart.useCart.mockReturnValue({
      addLine,
      busy: true,
      operations: { add: { kind: 'add', pending: true, error: null } },
    });
    const { getByRole } = await render(<ProductScreen />);

    const button = getByRole('button', { name: 'Add to cart' });
    expect(button).toHaveProp('accessibilityState', expect.objectContaining({ busy: true }));
  });

  it('shows a View cart action after a successful add', async () => {
    const addLine = jest.fn().mockResolvedValue(undefined);
    cart.useCart.mockReturnValue({ addLine, busy: false, operations: {} });
    const { getByRole } = await render(<ProductScreen />);

    await act(async () => {
      await fireEvent.press(getByRole('button', { name: 'Add to cart' }));
    });
    await fireEvent.press(getByRole('button', { name: 'View cart' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/cart');
  });

  it('renders Product loading state as a skeleton, not a spinner', async () => {
    hooks.useProduct.mockReturnValue(queryResult({ isPending: true }));
    const loading = await render(<ProductScreen />);
    expect(loading.getByRole('progressbar', { name: 'Loading product' })).toBeOnTheScreen();
  });

  it('renders the prefetched card snapshot instantly while the full product is still pending', async () => {
    hooks.useProduct.mockReturnValue(queryResult({ isPending: true }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['productCard', 'shirt'], productCard);

    const { getByText, getByRole, queryByText } = await baseRender(
      <QueryClientProvider client={client}>
        <ProductScreen />
      </QueryClientProvider>,
    );

    // The snapshot's title/vendor/price render immediately…
    expect(getByText('Predictive shirt')).toBeOnTheScreen();
    expect(getByText('Studio')).toBeOnTheScreen();
    // …while the rest is still a skeleton, not the description text from the full product.
    expect(getByRole('progressbar', { name: 'Loading product' })).toBeOnTheScreen();
    expect(queryByText('A long-lived shirt.')).toBeNull();
  });

  it('renders Product not-found state intentionally', async () => {
    hooks.useProduct.mockReturnValue(queryResult({ data: null }));
    const missing = await render(<ProductScreen />);
    expect(missing.getByText('Product not found')).toBeOnTheScreen();
  });

  it('shows the recommendations rail, excluding the current product, and hides it entirely when empty', async () => {
    hooks.useProductRecommendations.mockReturnValue(
      queryResult({
        data: [
          product,
          { ...productCard, id: 'gid://shopify/Product/2', handle: 'pants', title: 'Chino pants' },
        ],
      }),
    );
    const withRecs = await render(<ProductScreen />);
    expect(withRecs.getByText('You may also like')).toBeOnTheScreen();
    expect(withRecs.getByText('Chino pants')).toBeOnTheScreen();
    // The current product itself must not appear in its own rail.
    expect(withRecs.queryAllByText('Everyday shirt')).toHaveLength(1);

    hooks.useProductRecommendations.mockReturnValue(queryResult({ data: [] }));
    const empty = await render(<ProductScreen />);
    expect(empty.queryByText('You may also like')).toBeNull();
  });
});
