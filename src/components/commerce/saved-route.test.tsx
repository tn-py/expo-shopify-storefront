import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render as baseRender } from '@testing-library/react-native';

import SavedScreen from '@/app/saved';
import type { ProductCard } from '@/shopify/types';

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return baseRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/lib/analytics', () => ({ screen: jest.fn(), track: jest.fn() }));
jest.mock('@/shopify/hooks', () => ({ useWishlistProducts: jest.fn() }));
jest.mock('@/wishlist/wishlist', () => ({ useWishlist: jest.fn() }));
jest.mock('@/shopify/cart', () => ({ useCart: () => ({ clearLocal: jest.fn() }) }));

const hooks = jest.requireMock('@/shopify/hooks') as { useWishlistProducts: jest.Mock };
const wishlist = jest.requireMock('@/wishlist/wishlist') as { useWishlist: jest.Mock };

const image = { url: 'https://example.com/item.jpg', altText: 'Item', width: 800, height: 800 };
const money = { amount: '20.00', currencyCode: 'USD' };
const shirt: ProductCard = {
  id: 'gid://shopify/Product/1',
  handle: 'shirt',
  title: 'Everyday shirt',
  vendor: 'Studio',
  featuredImage: image,
  priceRange: { minVariantPrice: money, maxVariantPrice: money },
  compareAtPriceRange: { minVariantPrice: money, maxVariantPrice: money },
  availableForSale: true,
};

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  wishlist.useWishlist.mockReturnValue({ items: [], ready: true, isSaved: () => false, toggle: jest.fn(), remove: jest.fn() });
  hooks.useWishlistProducts.mockReturnValue(queryResult({ data: [] }));
});

describe('Saved screen', () => {
  it('shows an empty state with a Browse products action when nothing is saved', async () => {
    const { getByText, getByRole } = await render(<SavedScreen />);

    expect(getByText('Nothing saved yet')).toBeOnTheScreen();
    await fireEvent.press(getByRole('button', { name: 'Browse products' }));
    expect(mockPush).toHaveBeenCalledWith('/shop');
  });

  it('renders saved products refreshed from Shopify', async () => {
    wishlist.useWishlist.mockReturnValue({
      items: [shirt],
      ready: true,
      isSaved: () => true,
      toggle: jest.fn(),
      remove: jest.fn(),
    });
    hooks.useWishlistProducts.mockReturnValue(queryResult({ data: [shirt] }));

    const { getByText } = await render(<SavedScreen />);
    expect(getByText('Everyday shirt')).toBeOnTheScreen();
    expect(getByText('1 item')).toBeOnTheScreen();
  });

  it('drops locally-saved items Shopify no longer returns', async () => {
    wishlist.useWishlist.mockReturnValue({
      items: [shirt],
      ready: true,
      isSaved: () => true,
      toggle: jest.fn(),
      remove: jest.fn(),
    });
    hooks.useWishlistProducts.mockReturnValue(queryResult({ data: [] }));

    const { getByText } = await render(<SavedScreen />);
    expect(getByText('Nothing saved yet')).toBeOnTheScreen();
  });

  it('shows a loading state while the wishlist is still hydrating', async () => {
    wishlist.useWishlist.mockReturnValue({ items: [], ready: false, isSaved: () => false, toggle: jest.fn(), remove: jest.fn() });

    const { getByText } = await render(<SavedScreen />);
    expect(getByText('Loading saved items…')).toBeOnTheScreen();
  });
});
