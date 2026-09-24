import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { track } from '@/lib/analytics';
import { useWishlist, WishlistProvider, type WishlistContextValue } from '@/wishlist/wishlist';
import { WISHLIST_STORAGE_KEY, type WishlistItem } from '@/wishlist/wishlist-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockTrack = track as jest.Mock;

const image = { url: 'https://example.com/item.jpg', altText: 'Item', width: 800, height: 800 };
const money = { amount: '20.00', currencyCode: 'USD' };
const shirt: WishlistItem = {
  id: 'gid://shopify/Product/shirt',
  handle: 'shirt',
  title: 'Everyday shirt',
  vendor: 'Studio',
  featuredImage: image,
  priceRange: { minVariantPrice: money, maxVariantPrice: money },
  compareAtPriceRange: { minVariantPrice: money, maxVariantPrice: money },
  availableForSale: true,
};

let latest: WishlistContextValue | null = null;
let durableStorage: Map<string, string>;

function Probe() {
  const wishlist = useWishlist();
  useEffect(() => {
    latest = wishlist;
  }, [wishlist]);
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  latest = null;
  durableStorage = new Map();
  mockStorage.getItem.mockImplementation(async (key) => durableStorage.get(key) ?? null);
  mockStorage.setItem.mockImplementation(async (key, value) => {
    durableStorage.set(key, value);
  });
  mockStorage.removeItem.mockImplementation(async (key) => {
    durableStorage.delete(key);
  });
});

function renderWishlist() {
  return render(
    <WishlistProvider>
      <Probe />
    </WishlistProvider>,
  );
}

describe('WishlistProvider', () => {
  it('starts empty and becomes ready once AsyncStorage is checked', async () => {
    await renderWishlist();
    await waitFor(() => expect(latest?.ready).toBe(true));
    expect(latest?.items).toEqual([]);
  });

  it('rehydrates previously saved items from AsyncStorage', async () => {
    durableStorage.set(WISHLIST_STORAGE_KEY, JSON.stringify([shirt]));
    await renderWishlist();
    await waitFor(() => expect(latest?.ready).toBe(true));
    expect(latest?.items).toEqual([shirt]);
    expect(latest?.isSaved('shirt')).toBe(true);
  });

  it('toggle adds, persists, and tracks wishlist_added, then removes on a second toggle', async () => {
    await renderWishlist();
    await waitFor(() => expect(latest?.ready).toBe(true));

    await act(async () => {
      latest?.toggle(shirt);
    });
    expect(latest?.items).toEqual([shirt]);
    expect(mockTrack).toHaveBeenCalledWith('wishlist_added', { handle: 'shirt' });
    await waitFor(() =>
      expect(durableStorage.get(WISHLIST_STORAGE_KEY)).toBe(JSON.stringify([shirt])),
    );

    await act(async () => {
      latest?.toggle(shirt);
    });
    expect(latest?.items).toEqual([]);
    expect(mockTrack).toHaveBeenCalledWith('wishlist_removed', { handle: 'shirt' });
  });

  it('remove drops an item and tracks wishlist_removed', async () => {
    durableStorage.set(WISHLIST_STORAGE_KEY, JSON.stringify([shirt]));
    await renderWishlist();
    await waitFor(() => expect(latest?.items).toEqual([shirt]));

    await act(async () => {
      latest?.remove('shirt');
    });
    expect(latest?.items).toEqual([]);
    expect(mockTrack).toHaveBeenCalledWith('wishlist_removed', { handle: 'shirt' });
  });
});
