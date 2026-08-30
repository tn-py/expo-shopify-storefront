import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './auth';
import {
  cartErrorMessage,
  cartOperationReducer,
  createCartOperationState,
  QuantityUpdateQueue,
  recoverStaleCart as rebuildStaleCart,
  removalUndoInput,
  type CartLineInput,
  type CartOperationStatus,
} from './cart-operations';
import { storefront } from './client';
import {
  CART_BUYER_IDENTITY_UPDATE,
  CART_CREATE,
  CART_LINES_ADD,
  CART_LINES_REMOVE,
  CART_LINES_UPDATE,
  CART_QUERY,
} from './queries';
import type { Cart, CartLine } from './types';

const CART_ID_KEY = 'storefront.cart.id';

interface MutationResult {
  cart: Cart | null;
  userErrors: { message: string }[];
}
interface CartCreatePayload { cartCreate: MutationResult }
interface CartLinesAddPayload { cartLinesAdd: MutationResult }
interface CartLinesUpdatePayload { cartLinesUpdate: MutationResult }
interface CartLinesRemovePayload { cartLinesRemove: MutationResult }
interface CartBuyerIdentityUpdatePayload { cartBuyerIdentityUpdate: MutationResult }

export interface CartContextValue {
  cart: Cart | null;
  ready: boolean;
  /** Compatibility aggregate. New UI should use operation-specific state. */
  busy: boolean;
  operations: Record<string, CartOperationStatus>;
  lastRemovedLine: CartLine | null;
  totalQuantity: number;
  addLine: (variantId: string, quantity?: number) => Promise<void>;
  updateLine: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  undoRemove: () => Promise<void>;
  refresh: () => Promise<void>;
  recoverStaleCart: () => Promise<boolean>;
  syncBuyerIdentity: () => Promise<void>;
  clearOperationError: (key: string) => void;
  clearLocal: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

function firstError(errors: { message: string }[]): void {
  if (errors?.length) throw new Error(errors[0].message);
}

function requireCart(result: MutationResult): Cart {
  firstError(result.userErrors);
  if (!result.cart) throw new Error('Shopify did not return an updated cart.');
  return result.cart;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, customer } = useAuth();
  const [state, dispatch] = useReducer(cartOperationReducer, null, createCartOperationState);
  const [ready, setReady] = useState(false);
  const cartRef = useRef<Cart | null>(null);
  const syncedBuyerRef = useRef<string | null>(null);
  const buyerEmail = isAuthenticated ? customer?.emailAddress ?? null : null;

  const persistId = useCallback(async (id: string | null) => {
    if (id) await AsyncStorage.setItem(CART_ID_KEY, id);
    else await AsyncStorage.removeItem(CART_ID_KEY);
  }, []);

  const setCartValue = useCallback((cart: Cart | null) => {
    cartRef.current = cart;
    dispatch({ type: 'cartChanged', cart });
  }, []);

  const createRemoteCart = useCallback(async (lines: CartLineInput[]): Promise<Cart> => {
    const data = await storefront<CartCreatePayload>(CART_CREATE, {
      lines,
      buyerIdentity: buyerEmail ? { email: buyerEmail } : undefined,
    });
    return requireCart(data.cartCreate);
  }, [buyerEmail]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await AsyncStorage.getItem(CART_ID_KEY);
        if (id) {
          const data = await storefront<{ cart: Cart | null }>(CART_QUERY, { id });
          if (!cancelled) {
            setCartValue(data.cart);
            if (!data.cart) await persistId(null);
          }
        }
      } catch {
        // Rehydration is best-effort; a shopper can still start a new cart.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [persistId, setCartValue]);

  const refresh = useCallback(async () => {
    const current = cartRef.current;
    if (!current?.id) return;
    dispatch({ type: 'started', key: 'refresh', kind: 'refresh' });
    try {
      const data = await storefront<{ cart: Cart | null }>(CART_QUERY, { id: current.id });
      setCartValue(data.cart);
      if (!data.cart) await persistId(null);
      dispatch({ type: 'completed', key: 'refresh', cart: data.cart });
    } catch (error) {
      dispatch({ type: 'failed', key: 'refresh', message: cartErrorMessage('refresh') });
      throw error;
    }
  }, [persistId, setCartValue]);

  const addLine = useCallback(async (variantId: string, quantity = 1) => {
    dispatch({ type: 'started', key: 'add', kind: 'add' });
    try {
      const lines = [{ merchandiseId: variantId, quantity }];
      const current = cartRef.current;
      let next: Cart;
      if (!current?.id) {
        next = await createRemoteCart(lines);
        await persistId(next.id);
      } else {
        const data = await storefront<CartLinesAddPayload>(CART_LINES_ADD, {
          cartId: current.id,
          lines,
        });
        next = requireCart(data.cartLinesAdd);
      }
      setCartValue(next);
      dispatch({ type: 'completed', key: 'add', cart: next });
    } catch (error) {
      dispatch({ type: 'failed', key: 'add', message: cartErrorMessage('add') });
      throw error;
    }
  }, [createRemoteCart, persistId, setCartValue]);

  const [quantityQueue] = useState(() => new QuantityUpdateQueue());
  const writeQuantity = useCallback(async (lineId: string, quantity: number) => {
    const current = cartRef.current;
    if (!current?.id) return;
    const data = await storefront<CartLinesUpdatePayload>(CART_LINES_UPDATE, {
      cartId: current.id,
      lines: [{ id: lineId, quantity }],
    });
    const next = requireCart(data.cartLinesUpdate);
    setCartValue(next);
  }, [setCartValue]);

  const updateLine = useCallback(async (lineId: string, quantity: number) => {
    if (!cartRef.current?.id) return;
    const key = `line:${lineId}`;
    dispatch({ type: 'started', key, kind: 'update' });
    try {
      await quantityQueue.request(lineId, quantity, writeQuantity);
      dispatch({ type: 'completed', key, cart: cartRef.current });
    } catch (error) {
      dispatch({ type: 'failed', key, message: cartErrorMessage('update') });
      throw error;
    }
  }, [quantityQueue, writeQuantity]);

  const removeLine = useCallback(async (lineId: string) => {
    const current = cartRef.current;
    if (!current?.id) return;
    const removedLine = current.lines.nodes.find((line) => line.id === lineId);
    if (!removedLine) return;
    const key = `line:${lineId}`;
    dispatch({ type: 'started', key, kind: 'remove' });
    try {
      const data = await storefront<CartLinesRemovePayload>(CART_LINES_REMOVE, {
        cartId: current.id,
        lineIds: [lineId],
      });
      const next = requireCart(data.cartLinesRemove);
      setCartValue(next);
      dispatch({ type: 'completed', key, cart: next, removedLine });
    } catch (error) {
      dispatch({ type: 'failed', key, message: cartErrorMessage('remove') });
      throw error;
    }
  }, [setCartValue]);

  const undoRemove = useCallback(async () => {
    const removedLine = state.lastRemovedLine;
    const current = cartRef.current;
    if (!removedLine || !current?.id) return;
    dispatch({ type: 'started', key: 'undo', kind: 'undo' });
    try {
      const data = await storefront<CartLinesAddPayload>(CART_LINES_ADD, {
        cartId: current.id,
        lines: [removalUndoInput(removedLine)],
      });
      const next = requireCart(data.cartLinesAdd);
      setCartValue(next);
      dispatch({ type: 'completed', key: 'undo', cart: next, clearRemoved: true });
    } catch (error) {
      dispatch({ type: 'failed', key: 'undo', message: cartErrorMessage('undo') });
      throw error;
    }
  }, [setCartValue, state.lastRemovedLine]);

  const recoverStaleCart = useCallback(async (): Promise<boolean> => {
    const previous = cartRef.current;
    if (!previous) return false;
    dispatch({ type: 'started', key: 'refresh', kind: 'refresh' });
    try {
      const recovered = await rebuildStaleCart(
        previous,
        async (id) => (await storefront<{ cart: Cart | null }>(CART_QUERY, { id })).cart,
        createRemoteCart,
      );
      setCartValue(recovered);
      await persistId(recovered?.id ?? null);
      dispatch({ type: 'completed', key: 'refresh', cart: recovered });
      return Boolean(recovered);
    } catch (error) {
      dispatch({ type: 'failed', key: 'refresh', message: cartErrorMessage('refresh') });
      throw error;
    }
  }, [createRemoteCart, persistId, setCartValue]);

  const syncBuyerIdentity = useCallback(async () => {
    const current = cartRef.current;
    if (!current?.id || !buyerEmail) return;
    const synchronizationKey = `${current.id}:${buyerEmail}`;
    if (syncedBuyerRef.current === synchronizationKey) return;
    dispatch({ type: 'started', key: 'buyerIdentity', kind: 'buyerIdentity' });
    try {
      const data = await storefront<CartBuyerIdentityUpdatePayload>(CART_BUYER_IDENTITY_UPDATE, {
        cartId: current.id,
        buyerIdentity: { email: buyerEmail },
      });
      const next = requireCart(data.cartBuyerIdentityUpdate);
      syncedBuyerRef.current = synchronizationKey;
      setCartValue(next);
      dispatch({ type: 'completed', key: 'buyerIdentity', cart: next });
    } catch (error) {
      dispatch({ type: 'failed', key: 'buyerIdentity', message: cartErrorMessage('buyerIdentity') });
      throw error;
    }
  }, [buyerEmail, setCartValue]);

  const clearOperationError = useCallback((key: string) => {
    dispatch({ type: 'dismissed', key });
  }, []);

  const clearLocal = useCallback(async () => {
    syncedBuyerRef.current = null;
    cartRef.current = null;
    dispatch({ type: 'reset' });
    await persistId(null);
  }, [persistId]);

  const busy = Object.values(state.operations).some((operation) => operation.pending);
  const value = useMemo<CartContextValue>(() => ({
    cart: state.cart,
    ready,
    busy,
    operations: state.operations,
    lastRemovedLine: state.lastRemovedLine,
    totalQuantity: state.cart?.totalQuantity ?? 0,
    addLine,
    updateLine,
    removeLine,
    undoRemove,
    refresh,
    recoverStaleCart,
    syncBuyerIdentity,
    clearOperationError,
    clearLocal,
  }), [
    state,
    ready,
    busy,
    addLine,
    updateLine,
    removeLine,
    undoRemove,
    refresh,
    recoverStaleCart,
    syncBuyerIdentity,
    clearOperationError,
    clearLocal,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
