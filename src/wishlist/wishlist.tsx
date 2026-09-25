import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { track } from '@/lib/analytics';
import {
  isItemSaved,
  parseWishlistStorage,
  removeWishlistItem,
  serializeWishlist,
  toggleWishlistItem,
  WISHLIST_STORAGE_KEY,
  type WishlistItem,
} from './wishlist-store';

export interface WishlistContextValue {
  items: WishlistItem[];
  ready: boolean;
  isSaved: (handle: string) => boolean;
  toggle: (product: WishlistItem) => void;
  remove: (handle: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(WISHLIST_STORAGE_KEY);
        if (!cancelled) setItems(parseWishlistStorage(raw));
      } catch {
        // Best-effort hydration; an empty wishlist is a safe fallback.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: WishlistItem[]) => {
    try {
      await AsyncStorage.setItem(WISHLIST_STORAGE_KEY, serializeWishlist(next));
    } catch {
      // In-memory state still reflects the change even if persistence fails.
    }
  }, []);

  const toggle = useCallback(
    (product: WishlistItem) => {
      const wasSaved = isItemSaved(items, product.handle);
      const next = toggleWishlistItem(items, product);
      setItems(next);
      void persist(next);
      track(wasSaved ? 'wishlist_removed' : 'wishlist_added', { handle: product.handle });
    },
    [items, persist],
  );

  const remove = useCallback(
    (handle: string) => {
      const next = removeWishlistItem(items, handle);
      setItems(next);
      void persist(next);
      track('wishlist_removed', { handle });
    },
    [items, persist],
  );

  const isSaved = useCallback((handle: string) => isItemSaved(items, handle), [items]);

  const value = useMemo<WishlistContextValue>(
    () => ({ items, ready, isSaved, toggle, remove }),
    [items, ready, isSaved, toggle, remove],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
}
