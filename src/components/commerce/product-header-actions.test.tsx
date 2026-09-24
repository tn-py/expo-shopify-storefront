import { fireEvent, render } from '@testing-library/react-native';
import { Share } from 'react-native';

import { ProductHeaderActions } from '@/components/commerce/product-header-actions';
import { track } from '@/lib/analytics';
import type { ProductCard } from '@/shopify/types';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/wishlist/wishlist', () => ({ useWishlist: jest.fn() }));

const mockShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
const mockTrack = track as jest.Mock;
const wishlist = jest.requireMock('@/wishlist/wishlist') as { useWishlist: jest.Mock };

const image = { url: 'https://example.com/item.jpg', altText: 'Item', width: 800, height: 800 };
const money = { amount: '20.00', currencyCode: 'USD' };
const product: ProductCard = {
  id: 'product-1',
  handle: 'shirt',
  title: 'Everyday shirt',
  vendor: 'Studio',
  featuredImage: image,
  priceRange: { minVariantPrice: money, maxVariantPrice: money },
  compareAtPriceRange: { minVariantPrice: money, maxVariantPrice: money },
  availableForSale: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockShare.mockResolvedValue({ action: 'sharedAction' });
  wishlist.useWishlist.mockReturnValue({
    isSaved: () => false,
    toggle: jest.fn(),
    remove: jest.fn(),
    items: [],
    ready: true,
  });
});

describe('ProductHeaderActions', () => {
  it('shares the storefront product URL and tracks the event', async () => {
    const { getByRole } = await render(
      <ProductHeaderActions product={product} shareUrl="https://shop.example/products/shirt" />,
    );

    await fireEvent.press(getByRole('button', { name: 'Share Everyday shirt' }));

    expect(mockShare).toHaveBeenCalledWith({
      message: 'https://shop.example/products/shirt',
      url: 'https://shop.example/products/shirt',
      title: 'Everyday shirt',
    });
    expect(mockTrack).toHaveBeenCalledWith('share', { handle: 'shirt' });
  });

  it('does not throw when the share sheet is dismissed', async () => {
    mockShare.mockRejectedValue(new Error('User did not share'));
    const { getByRole } = await render(
      <ProductHeaderActions product={product} shareUrl="https://shop.example/products/shirt" />,
    );

    await fireEvent.press(getByRole('button', { name: 'Share Everyday shirt' }));
    expect(mockTrack).not.toHaveBeenCalledWith('share', expect.anything());
  });

  it('exposes an accessible wishlist toggle next to Share', async () => {
    const toggle = jest.fn();
    wishlist.useWishlist.mockReturnValue({
      isSaved: () => true,
      toggle,
      remove: jest.fn(),
      items: [product],
      ready: true,
    });
    const { getByRole } = await render(
      <ProductHeaderActions product={product} shareUrl="https://shop.example/products/shirt" />,
    );

    const heart = getByRole('button', { name: 'Remove Everyday shirt from saved' });
    expect(heart).toHaveProp('accessibilityState', { selected: true });
    await fireEvent.press(heart);
    expect(toggle).toHaveBeenCalledWith(product);
  });
});
