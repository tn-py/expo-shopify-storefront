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
  buyerIdentityKey,
  cartErrorMessage,
  cartOperationReducer,
  CartSnapshotSequencer,
  createCartOperationState,
  QuantityUpdateQueue,
  recoverStaleCart as rebuildStaleCart,
  removalUndoInput,
  resolveBuyerIdentityTarget,
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
  buyerIdentityReady: boolean;
  buyerIdentityResolved: boolean;
  buyerIdentityError: string | null;
  buyerIdentityErrorKind: 'profile' | 'sync' | null;
  retryBuyerIdentity: () => Promise<void>;
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
  const {
    ready: authReady,
    isAuthenticated,
    customer,
    customerProfileStatus,
    customerProfileError,
    retryCustomerProfile,
  } = useAuth();
  const [state, dispatch] = useReducer(cartOperationReducer, null, createCartOperationState);
  const [ready, setReady] = useState(false);
  const [snapshotSequencer] = useState(() => new CartSnapshotSequencer());
  const [syncedBuyerKey, setSyncedBuyerKey] = useState<string | null>(null);
  const cartRef = useRef<Cart | null>(null);
  const syncedBuyerRef = useRef<string | null>(null);
  const buyerIdentitySyncRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const buyerIdentityTarget = useMemo(
    () => resolveBuyerIdentityTarget(
      authReady,
      isAuthenticated,
      customer,
      customerProfileStatus,
      customerProfileError,
    ),
    [
      authReady,
      customer,
      customerProfileError,
      customerProfileStatus,
      isAuthenticated,
    ],
  );

  const persistId = useCallback(async (id: string | null) => {
    if (id) await AsyncStorage.setItem(CART_ID_KEY, id);
    else await AsyncStorage.removeItem(CART_ID_KEY);
  }, []);

  const setCartValue = useCallback((cart: Cart | null) => {
    cartRef.current = cart;
    dispatch({ type: 'cartChanged', cart });
  }, []);

  const applyCartSnapshot = useCallback((version: number, cart: Cart | null): boolean => {
    if (!snapshotSequencer.accept(version)) return false;
    setCartValue(cart);
    return true;
  }, [setCartValue, snapshotSequencer]);

  const createRemoteCart = useCallback(async (lines: CartLineInput[]): Promise<Cart> => {
    const data = await storefront<CartCreatePayload>(CART_CREATE, {
      lines,
      buyerIdentity:
        buyerIdentityTarget.status === 'ready'
          ? { email: buyerIdentityTarget.email }
          : undefined,
    });
    return requireCart(data.cartCreate);
  }, [buyerIdentityTarget]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const version = snapshotSequencer.begin();
      try {
        const id = await AsyncStorage.getItem(CART_ID_KEY);
        if (id) {
          const data = await storefront<{ cart: Cart | null }>(CART_QUERY, { id });
          if (!cancelled) {
            const accepted = applyCartSnapshot(version, data.cart);
            if (accepted && !data.cart) await persistId(null);
          }
        }
      } catch {
        // Rehydration is best-effort; a shopper can still start a new cart.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [applyCartSnapshot, persistId, snapshotSequencer]);

  const refresh = useCallback(async () => {
    const current = cartRef.current;
    if (!current?.id) return;
    const version = snapshotSequencer.begin();
    dispatch({ type: 'started', key: 'refresh', kind: 'refresh' });
    try {
      const data = await storefront<{ cart: Cart | null }>(CART_QUERY, { id: current.id });
      const accepted = applyCartSnapshot(version, data.cart);
      if (accepted && !data.cart) await persistId(null);
      dispatch({ type: 'completed', key: 'refresh' });
    } catch (error) {
      dispatch({ type: 'failed', key: 'refresh', message: cartErrorMessage('refresh') });
      throw error;
    }
  }, [applyCartSnapshot, persistId, snapshotSequencer]);

  const addLine = useCallback(async (variantId: string, quantity = 1) => {
    const version = snapshotSequencer.begin();
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
      applyCartSnapshot(version, next);
      dispatch({ type: 'completed', key: 'add' });
    } catch (error) {
      dispatch({ type: 'failed', key: 'add', message: cartErrorMessage('add') });
      throw error;
    }
  }, [applyCartSnapshot, createRemoteCart, persistId, snapshotSequencer]);

  const [quantityQueue] = useState(() => new QuantityUpdateQueue());
  const writeQuantity = useCallback(async (lineId: string, quantity: number) => {
    const version = snapshotSequencer.begin();
    const current = cartRef.current;
    if (!current?.id) return;
    const data = await storefront<CartLinesUpdatePayload>(CART_LINES_UPDATE, {
      cartId: current.id,
      lines: [{ id: lineId, quantity }],
    });
    const next = requireCart(data.cartLinesUpdate);
    applyCartSnapshot(version, next);
  }, [applyCartSnapshot, snapshotSequencer]);

  const updateLine = useCallback(async (lineId: string, quantity: number) => {
    if (!cartRef.current?.id) return;
    const key = `line:${lineId}`;
    dispatch({ type: 'started', key, kind: 'update' });
    try {
      await quantityQueue.request(lineId, quantity, writeQuantity);
      dispatch({ type: 'completed', key });
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
    const version = snapshotSequencer.begin();
    const key = `line:${lineId}`;
    dispatch({ type: 'started', key, kind: 'remove' });
    try {
      const data = await storefront<CartLinesRemovePayload>(CART_LINES_REMOVE, {
        cartId: current.id,
        lineIds: [lineId],
      });
      const next = requireCart(data.cartLinesRemove);
      const accepted = applyCartSnapshot(version, next);
      dispatch({ type: 'completed', key, removedLine: accepted ? removedLine : undefined });
    } catch (error) {
      dispatch({ type: 'failed', key, message: cartErrorMessage('remove') });
      throw error;
    }
  }, [applyCartSnapshot, snapshotSequencer]);

  const undoRemove = useCallback(async () => {
    const removedLine = state.lastRemovedLine;
    const current = cartRef.current;
    if (!removedLine || !current?.id) return;
    const version = snapshotSequencer.begin();
    dispatch({ type: 'started', key: 'undo', kind: 'undo' });
    try {
      const data = await storefront<CartLinesAddPayload>(CART_LINES_ADD, {
        cartId: current.id,
        lines: [removalUndoInput(removedLine)],
      });
      const next = requireCart(data.cartLinesAdd);
      const accepted = applyCartSnapshot(version, next);
      dispatch({ type: 'completed', key: 'undo', clearRemoved: accepted });
    } catch (error) {
      dispatch({ type: 'failed', key: 'undo', message: cartErrorMessage('undo') });
      throw error;
    }
  }, [applyCartSnapshot, snapshotSequencer, state.lastRemovedLine]);

  const recoverStaleCart = useCallback(async (): Promise<boolean> => {
    const previous = cartRef.current;
    if (!previous) return false;
    const version = snapshotSequencer.begin();
    dispatch({ type: 'started', key: 'refresh', kind: 'refresh' });
    try {
      const recovered = await rebuildStaleCart(
        previous,
        async (id) => (await storefront<{ cart: Cart | null }>(CART_QUERY, { id })).cart,
        createRemoteCart,
      );
      const accepted = applyCartSnapshot(version, recovered);
      if (accepted) await persistId(recovered?.id ?? null);
      dispatch({ type: 'completed', key: 'refresh' });
      return accepted && Boolean(recovered);
    } catch (error) {
      dispatch({ type: 'failed', key: 'refresh', message: cartErrorMessage('refresh') });
      throw error;
    }
  }, [applyCartSnapshot, createRemoteCart, persistId, snapshotSequencer]);

  const markBuyerIdentitySynced = useCallback((key: string) => {
    if (syncedBuyerRef.current === key) return;
    syncedBuyerRef.current = key;
    setSyncedBuyerKey(key);
  }, []);

  const syncBuyerIdentity = useCallback(async () => {
    if (buyerIdentityTarget.status !== 'ready') {
      throw new Error(
        buyerIdentityTarget.status === 'error'
          ? buyerIdentityTarget.message
          : 'Buyer identity is still loading.',
      );
    }
    let current = cartRef.current;
    if (!current?.id) return;
    const synchronizationKey = buyerIdentityKey(current.id, buyerIdentityTarget);
    if (syncedBuyerRef.current === synchronizationKey) return;
    if (current.buyerIdentity !== undefined && current.buyerIdentity?.email === buyerIdentityTarget.email) {
      markBuyerIdentitySynced(synchronizationKey);
      return;
    }

    const inFlight = buyerIdentitySyncRef.current;
    if (inFlight) {
      try {
        await inFlight.promise;
      } catch {
        // A changed identity still needs its own synchronization attempt.
      }
      current = cartRef.current;
      if (!current?.id) return;
      if (syncedBuyerRef.current === synchronizationKey) return;
    }

    const version = snapshotSequencer.begin();
    dispatch({ type: 'started', key: 'buyerIdentity', kind: 'buyerIdentity' });
    let promise!: Promise<void>;
    promise = (async () => {
      try {
        const data = await storefront<CartBuyerIdentityUpdatePayload>(CART_BUYER_IDENTITY_UPDATE, {
          cartId: current.id,
          buyerIdentity: { email: buyerIdentityTarget.email },
        });
        const next = requireCart(data.cartBuyerIdentityUpdate);
        if (applyCartSnapshot(version, next)) markBuyerIdentitySynced(synchronizationKey);
        dispatch({ type: 'completed', key: 'buyerIdentity' });
      } catch (error) {
        dispatch({ type: 'failed', key: 'buyerIdentity', message: cartErrorMessage('buyerIdentity') });
        throw error;
      } finally {
        if (buyerIdentitySyncRef.current?.promise === promise) {
          buyerIdentitySyncRef.current = null;
        }
      }
    })();
    buyerIdentitySyncRef.current = { key: synchronizationKey, promise };
    await promise;
  }, [
    applyCartSnapshot,
    buyerIdentityTarget,
    markBuyerIdentitySynced,
    snapshotSequencer,
  ]);

  useEffect(() => {
    if (!state.cart || buyerIdentityTarget.status !== 'ready') return;
    void syncBuyerIdentity().catch(() => {
      // The operation error remains available for checkout recovery UI.
    });
  }, [buyerIdentityTarget, state.cart, syncBuyerIdentity]);

  const retryBuyerIdentity = useCallback(async () => {
    if (buyerIdentityTarget.status === 'error') {
      await retryCustomerProfile();
      return;
    }
    await syncBuyerIdentity();
  }, [buyerIdentityTarget.status, retryCustomerProfile, syncBuyerIdentity]);

  const clearOperationError = useCallback((key: string) => {
    dispatch({ type: 'dismissed', key });
  }, []);

  const clearLocal = useCallback(async () => {
    snapshotSequencer.invalidate();
    syncedBuyerRef.current = null;
    setSyncedBuyerKey(null);
    cartRef.current = null;
    dispatch({ type: 'reset' });
    await persistId(null);
  }, [persistId, snapshotSequencer]);

  const busy = Object.values(state.operations).some((operation) => operation.pending);
  const desiredBuyerIdentityKey =
    state.cart && buyerIdentityTarget.status === 'ready'
      ? buyerIdentityKey(state.cart.id, buyerIdentityTarget)
      : null;
  const buyerIdentityReady =
    !state.cart ||
    (desiredBuyerIdentityKey !== null && syncedBuyerKey === desiredBuyerIdentityKey);
  const buyerIdentityResolved = buyerIdentityTarget.status === 'ready';
  const buyerIdentityError =
    buyerIdentityTarget.status === 'error'
      ? buyerIdentityTarget.message
      : state.operations.buyerIdentity?.error ?? null;
  const buyerIdentityErrorKind = buyerIdentityTarget.status === 'error'
    ? 'profile' as const
    : state.operations.buyerIdentity?.error
      ? 'sync' as const
      : null;
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
    buyerIdentityReady,
    buyerIdentityResolved,
    buyerIdentityError,
    buyerIdentityErrorKind,
    retryBuyerIdentity,
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
    buyerIdentityReady,
    buyerIdentityResolved,
    buyerIdentityError,
    buyerIdentityErrorKind,
    retryBuyerIdentity,
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
