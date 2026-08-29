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

import { storefront } from './client';
import {
  CART_CREATE,
  CART_LINES_ADD,
  CART_LINES_REMOVE,
  CART_LINES_UPDATE,
  CART_QUERY,
} from './queries';
import type { Cart } from './types';

const CART_ID_KEY = 'storefront.cart.id';

interface CartCreatePayload {
  cartCreate: { cart: Cart | null; userErrors: { message: string }[] };
}
interface CartLinesAddPayload {
  cartLinesAdd: { cart: Cart | null; userErrors: { message: string }[] };
}
interface CartLinesUpdatePayload {
  cartLinesUpdate: { cart: Cart | null; userErrors: { message: string }[] };
}
interface CartLinesRemovePayload {
  cartLinesRemove: { cart: Cart | null; userErrors: { message: string }[] };
}

interface CartContextValue {
  cart: Cart | null;
  ready: boolean;
  busy: boolean;
  totalQuantity: number;
  addLine: (variantId: string, quantity?: number) => Promise<void>;
  updateLine: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearLocal: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

function firstError(errors: { message: string }[]): void {
  if (errors?.length) throw new Error(errors[0].message);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const persistId = useCallback(async (id: string | null) => {
    if (id) await AsyncStorage.setItem(CART_ID_KEY, id);
    else await AsyncStorage.removeItem(CART_ID_KEY);
  }, []);

  // Rehydrate a saved cart on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await AsyncStorage.getItem(CART_ID_KEY);
        if (id) {
          const data = await storefront<{ cart: Cart | null }>(CART_QUERY, { id });
          if (!cancelled) {
            if (data.cart) setCart(data.cart);
            else await persistId(null); // stale / completed cart
          }
        }
      } catch {
        // ignore — user just starts with an empty cart
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistId]);

  const refresh = useCallback(async () => {
    if (!cart?.id) return;
    const data = await storefront<{ cart: Cart | null }>(CART_QUERY, {
      id: cart.id,
    });
    setCart(data.cart);
    if (!data.cart) await persistId(null);
  }, [cart, persistId]);

  const addLine = useCallback(
    async (variantId: string, quantity = 1) => {
      setBusy(true);
      try {
        const lines = [{ merchandiseId: variantId, quantity }];
        if (!cart?.id) {
          const data = await storefront<CartCreatePayload>(CART_CREATE, { lines });
          firstError(data.cartCreate.userErrors);
          setCart(data.cartCreate.cart);
          await persistId(data.cartCreate.cart?.id ?? null);
        } else {
          const data = await storefront<CartLinesAddPayload>(CART_LINES_ADD, {
            cartId: cart.id,
            lines,
          });
          firstError(data.cartLinesAdd.userErrors);
          setCart(data.cartLinesAdd.cart);
        }
      } finally {
        setBusy(false);
      }
    },
    [cart, persistId],
  );

  const updateLine = useCallback(
    async (lineId: string, quantity: number) => {
      if (!cart?.id) return;
      setBusy(true);
      try {
        const data = await storefront<CartLinesUpdatePayload>(CART_LINES_UPDATE, {
          cartId: cart.id,
          lines: [{ id: lineId, quantity }],
        });
        firstError(data.cartLinesUpdate.userErrors);
        setCart(data.cartLinesUpdate.cart);
      } finally {
        setBusy(false);
      }
    },
    [cart],
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      if (!cart?.id) return;
      setBusy(true);
      try {
        const data = await storefront<CartLinesRemovePayload>(CART_LINES_REMOVE, {
          cartId: cart.id,
          lineIds: [lineId],
        });
        firstError(data.cartLinesRemove.userErrors);
        setCart(data.cartLinesRemove.cart);
      } finally {
        setBusy(false);
      }
    },
    [cart],
  );

  const clearLocal = useCallback(async () => {
    setCart(null);
    await persistId(null);
  }, [persistId]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      ready,
      busy,
      totalQuantity: cart?.totalQuantity ?? 0,
      addLine,
      updateLine,
      removeLine,
      refresh,
      clearLocal,
    }),
    [cart, ready, busy, addLine, updateLine, removeLine, refresh, clearLocal],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
