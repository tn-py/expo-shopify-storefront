import {
  addWishlistItem,
  isItemSaved,
  parseWishlistStorage,
  removeWishlistItem,
  serializeWishlist,
  toggleWishlistItem,
  WISHLIST_MAX_ITEMS,
  type WishlistItem,
} from '@/wishlist/wishlist-store';

const image = { url: 'https://example.com/item.jpg', altText: 'Item', width: 800, height: 800 };
const money = { amount: '20.00', currencyCode: 'USD' };

function item(handle: string): WishlistItem {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    title: handle,
    vendor: 'Studio',
    featuredImage: image,
    priceRange: { minVariantPrice: money, maxVariantPrice: money },
    compareAtPriceRange: { minVariantPrice: money, maxVariantPrice: money },
    availableForSale: true,
  };
}

describe('wishlist store', () => {
  it('adds a new item to the front and de-duplicates by handle', () => {
    const shirt = item('shirt');
    const pants = item('pants');
    const withShirt = addWishlistItem([], shirt);
    const withBoth = addWishlistItem(withShirt, pants);

    expect(withBoth.map((entry) => entry.handle)).toEqual(['pants', 'shirt']);

    const movedShirtToFront = addWishlistItem(withBoth, shirt);
    expect(movedShirtToFront.map((entry) => entry.handle)).toEqual(['shirt', 'pants']);
  });

  it('caps the list at the maximum size, dropping the oldest', () => {
    const items = Array.from({ length: WISHLIST_MAX_ITEMS }, (_, index) => item(`p${index}`));
    const overflowed = addWishlistItem(items, item('newest'));

    expect(overflowed).toHaveLength(WISHLIST_MAX_ITEMS);
    expect(overflowed[0].handle).toBe('newest');
    // Index 0 is the most-recently-saved end; the last item is the oldest and is the one dropped.
    expect(overflowed.some((entry) => entry.handle === `p${WISHLIST_MAX_ITEMS - 1}`)).toBe(false);
  });

  it('removes an item by handle', () => {
    const items = [item('shirt'), item('pants')];
    expect(removeWishlistItem(items, 'shirt').map((entry) => entry.handle)).toEqual(['pants']);
  });

  it('toggles add/remove based on current membership', () => {
    const shirt = item('shirt');
    const added = toggleWishlistItem([], shirt);
    expect(isItemSaved(added, 'shirt')).toBe(true);

    const removed = toggleWishlistItem(added, shirt);
    expect(isItemSaved(removed, 'shirt')).toBe(false);
  });

  it('round-trips through JSON persistence', () => {
    const items = [item('shirt')];
    expect(parseWishlistStorage(serializeWishlist(items))).toEqual(items);
  });

  it('drops corrupted or malformed persisted entries instead of throwing', () => {
    expect(parseWishlistStorage(null)).toEqual([]);
    expect(parseWishlistStorage('not json')).toEqual([]);
    expect(parseWishlistStorage('{"not":"an array"}')).toEqual([]);
    expect(parseWishlistStorage(JSON.stringify([{ handle: 'missing-fields' }]))).toEqual([]);
  });
});
