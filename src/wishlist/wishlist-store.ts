/**
 * Pure, storage-shape logic for the local wishlist ("Saved items"). Kept free
 * of AsyncStorage/React so it's trivial to unit test; `wishlist.tsx` wires
 * this up to persistence and context.
 */

import type { ProductCard } from '@/shopify/types';

/** A saved product is stored as a lightweight card snapshot, not a live product. */
export type WishlistItem = ProductCard;

export const WISHLIST_STORAGE_KEY = 'storefront.wishlist.v1';
export const WISHLIST_MAX_ITEMS = 100;

function isWishlistItem(value: unknown): value is WishlistItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WishlistItem>;
  return typeof item.id === 'string' && typeof item.handle === 'string' && typeof item.title === 'string';
}

/** Parses persisted JSON, dropping anything malformed rather than throwing. */
export function parseWishlistStorage(raw: string | null | undefined): WishlistItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWishlistItem).slice(0, WISHLIST_MAX_ITEMS);
  } catch {
    return [];
  }
}

export function serializeWishlist(items: WishlistItem[]): string {
  return JSON.stringify(items);
}

export function isItemSaved(items: WishlistItem[], handle: string): boolean {
  return items.some((item) => item.handle === handle);
}

/** Adds/moves `product` to the front, capped at `WISHLIST_MAX_ITEMS`. */
export function addWishlistItem(items: WishlistItem[], product: WishlistItem): WishlistItem[] {
  const withoutExisting = items.filter((item) => item.handle !== product.handle);
  return [product, ...withoutExisting].slice(0, WISHLIST_MAX_ITEMS);
}

export function removeWishlistItem(items: WishlistItem[], handle: string): WishlistItem[] {
  return items.filter((item) => item.handle !== handle);
}

export function toggleWishlistItem(items: WishlistItem[], product: WishlistItem): WishlistItem[] {
  return isItemSaved(items, product.handle)
    ? removeWishlistItem(items, product.handle)
    : addWishlistItem(items, product);
}
