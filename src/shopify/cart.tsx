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

import { track } from '@/lib/analytics';
import { hapticWarning } from '@/lib/haptics';
import { captureException } from '@/lib/monitoring';
import { useAuth } from './auth';
import {
  buyerIdentityKey,
  buyerIdentityKeyMatchesTarget,
  buyerIdentityUpdateInput,
  cartCreateBuyerIdentity,
  CartIdPersistenceCoordinator,
  cartErrorMessage,
  cartOperationReducer,
  CartSnapshotSequencer,
  createCartOperationState,
  fingerprintToken,
  QuantityUpdateQueue,
  recoverStaleCart as rebuildStaleCart,
  removalUndoInput,
  resolveBuyerIdentityTarget,
  type CartSnapshotToken,
  type CartLineInput,
  type CartOperationStatus,
} from './cart-operations';
import { storefront } from './client';
import { inContextVariables, storefrontLocale } from './locale';
import {
  CART_BUYER_IDENTITY_UPDATE,
  CART_CREATE,
  CART_DISCOUNT_CODES_UPDATE,
  CART_LINES_ADD,
  CART_LINES_REMOVE,
  CART_LINES_UPDATE,
  CART_QUERY,
} from './queries';
import type { Cart, CartLine, CartWarning } from './types';

const CART_ID_KEY = 'storefront.cart.id';
const marketCountryCode = storefrontLocale?.country ?? null;

interface MutationResult {
  cart: Cart | null;
  userErrors: { message: string }[];
  warnings?: CartWarning[];
}
interface CartCreatePayload { cartCreate: MutationResult }
interface CartLinesAddPayload { cartLinesAdd: MutationResult }
interface CartLinesUpdatePayload { cartLinesUpdate: MutationResult }
interface CartLinesRemovePayload { cartLinesRemove: MutationResult }
interface CartBuyerIdentityUpdatePayload { cartBuyerIdentityUpdate: MutationResult }
interface CartDiscountCodesUpdatePayload { cartDiscountCodesUpdate: MutationResult }

export interface CartContextValue {
  cart: Cart | null;
  ready: boolean;
  /** Compatibility aggregate. New UI should use operation-specific state. */
  busy: boolean;
  operations: Record<string, CartOperationStatus>;
  lastRemovedLine: CartLine | null;
  totalQuantity: number;
  warnings: CartWarning[];
  dismissWarnings: () => void;
  addLine: (variantId: string, quantity?: number) => Promise<void>;
  updateLine: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  undoRemove: () => Promise<void>;
  applyDiscountCode: (code: string) => Promise<void>;
  removeDiscountCode: (code: string) => Promise<void>;
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
    getAccessToken,
  } = useAuth();
  const [state, dispatch] = useReducer(cartOperationReducer, null, createCartOperationState);
  const [ready, setReady] = useState(false);
  const [snapshotSequencer] = useState(() => new CartSnapshotSequencer());
  const [cartIdPersistence] = useState(() => new CartIdPersistenceCoordinator(
    (token) => snapshotSequencer.isCurrent(token),
    async (id) => {
      if (id) await AsyncStorage.setItem(CART_ID_KEY, id);
      else await AsyncStorage.removeItem(CART_ID_KEY);
    },
  ));
  const [syncedBuyerKey, setSyncedBuyerKey] = useState<string | null>(null);
  const cartRef = useRef<Cart | null>(null);
  const syncedBuyerRef = useRef<string | null>(null);
  const previousIdentityKindRef = useRef<'guest' | 'customer' | null>(null);
  const buyerIdentitySyncRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const buyerIdentityTarget = useMemo(
    () => resolveBuyerIdentityTarget(
      authReady,
      isAuthenticated,
      customer,
      customerProfileStatus,
      customerProfileError,
      marketCountryCode,
    ),
    [
      authReady,
      customer,
      customerProfileError,
      customerProfileStatus,
      isAuthenticated,
    ],
  );

  const persistId = useCallback(
    (token: CartSnapshotToken, id: string | null) => cartIdPersistence.persist(token, id),
    [cartIdPersistence],
  );

  const setCartValue = useCallback((cart: Cart | null) => {
    cartRef.current = cart;
    dispatch({ type: 'cartChanged', cart });
  }, []);

  const applyCartSnapshot = useCallback((token: CartSnapshotToken, cart: Cart | null): boolean => {
    if (!snapshotSequencer.accept(token)) return false;
    setCartValue(cart);
    return true;
  }, [setCartValue, snapshotSequencer]);

  const applyMutationSnapshot = useCallback(async (
    token: CartSnapshotToken,
    cart: Cart,
  ): Promise<boolean> => {
    if (!snapshotSequencer.isCurrent(token)) return false;
    if (applyCartSnapshot(token, cart)) return true;
    if (!snapshotSequencer.isCurrent(token)) return false;

    // A later full-cart response already won the local race. Re-read Shopify's
    // authoritative snapshot so the older acknowledged mutation is not lost.
    const cartId = cartRef.current?.id ?? cart.id;
    const reconciliationVersion = snapshotSequencer.begin();
    const data = await storefront<{ cart: Cart | null }>(CART_QUERY, {
      id: cartId,
      ...inContextVariables(),
    });
    const accepted = applyCartSnapshot(reconciliationVersion, data.cart);
    if (accepted && !data.cart) await persistId(reconciliationVersion, null);
    return accepted;
  }, [applyCartSnapshot, persistId, snapshotSequencer]);

  const finishMutation = useCallback((
    key: string,
    warnings: CartWarning[] = [],
    extra: { removedLine?: CartLine | null; clearRemoved?: boolean } = {},
  ) => {
    if (warnings.length) {
      hapticWarning();
      dispatch({ type: 'warningsReceived', warnings });
    }
    dispatch({ type: 'completed', key, ...extra });
  }, []);

  const createRemoteCart = useCallback(async (
    lines: CartLineInput[],
  ): Promise<{ cart: Cart; warnings: CartWarning[] }> => {
    const data = await storefront<CartCreatePayload>(CART_CREATE, {
      lines,
      buyerIdentity: cartCreateBuyerIdentity(buyerIdentityTarget),
      ...inContextVariables(),
    });
    return { cart: requireCart(data.cartCreate), warnings: data.cartCreate.warnings ?? [] };
  }, [buyerIdentityTarget]);
  const createRemoteCartOnly = useCallback(
    async (lines: CartLineInput[]): Promise<Cart> => (await createRemoteCart(lines)).cart,
    [createRemoteCart],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const version = snapshotSequencer.begin();
      try {
        const id = await AsyncStorage.getItem(CART_ID_KEY);
        if (id) {
          const data = await storefront<{ cart: Cart | null }>(CART_QUERY, {
            id,
            ...inContextVariables(),
          });
          if (!cancelled) {
            const accepted = applyCartSnapshot(version, data.cart);
            if (accepted && !data.cart) await persistId(version, null);
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
      const data = await storefront<{ cart: Cart | null }>(CART_QUERY, {
        id: current.id,
        ...inContextVariables(),
      });
      const accepted = applyCartSnapshot(version, data.cart);
      if (accepted && !data.cart) await persistId(version, null);
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
      let warnings: CartWarning[] = [];
      if (!current?.id) {
        const created = await createRemoteCart(lines);
        next = created.cart;
        warnings = created.warnings;
        if (!await persistId(version, next.id)) return;
      } else {
        const data = await storefront<CartLinesAddPayload>(CART_LINES_ADD, {
          cartId: current.id,
          lines,
          ...inContextVariables(),
        });
        next = requireCart(data.cartLinesAdd);
        warnings = data.cartLinesAdd.warnings ?? [];
      }
      await applyMutationSnapshot(version, next);
      finishMutation('add', warnings);
    } catch (error) {
      dispatch({ type: 'failed', key: 'add', message: cartErrorMessage('add') });
      throw error;
    }
  }, [applyMutationSnapshot, createRemoteCart, finishMutation, persistId, snapshotSequencer]);

  const [quantityQueue] = useState(() => new QuantityUpdateQueue());
  const writeQuantity = useCallback(async (lineId: string, quantity: number) => {
    const version = snapshotSequencer.begin();
    const current = cartRef.current;
    if (!current?.id) return;
    const data = await storefront<CartLinesUpdatePayload>(CART_LINES_UPDATE, {
      cartId: current.id,
      lines: [{ id: lineId, quantity }],
      ...inContextVariables(),
    });
    const next = requireCart(data.cartLinesUpdate);
    await applyMutationSnapshot(version, next);
    const warnings = data.cartLinesUpdate.warnings ?? [];
    if (warnings.length) {
      hapticWarning();
      dispatch({ type: 'warningsReceived', warnings });
    }
  }, [applyMutationSnapshot, snapshotSequencer]);

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
        ...inContextVariables(),
      });
      const next = requireCart(data.cartLinesRemove);
      const accepted = await applyMutationSnapshot(version, next);
      finishMutation(key, data.cartLinesRemove.warnings ?? [], { removedLine: accepted ? removedLine : undefined });
    } catch (error) {
      dispatch({ type: 'failed', key, message: cartErrorMessage('remove') });
      throw error;
    }
  }, [applyMutationSnapshot, finishMutation, snapshotSequencer]);

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
        ...inContextVariables(),
      });
      const next = requireCart(data.cartLinesAdd);
      const accepted = await applyMutationSnapshot(version, next);
      finishMutation('undo', data.cartLinesAdd.warnings ?? [], { clearRemoved: accepted });
    } catch (error) {
      dispatch({ type: 'failed', key: 'undo', message: cartErrorMessage('undo') });
      throw error;
    }
  }, [applyMutationSnapshot, finishMutation, snapshotSequencer, state.lastRemovedLine]);

  const updateDiscountCodes = useCallback(async (codes: string[]) => {
    const current = cartRef.current;
    if (!current?.id) return;
    const version = snapshotSequencer.begin();
    dispatch({ type: 'started', key: 'discount', kind: 'discount' });
    try {
      const data = await storefront<CartDiscountCodesUpdatePayload>(CART_DISCOUNT_CODES_UPDATE, {
        cartId: current.id,
        discountCodes: codes,
        ...inContextVariables(),
      });
      const next = requireCart(data.cartDiscountCodesUpdate);
      await applyMutationSnapshot(version, next);
      finishMutation('discount', data.cartDiscountCodesUpdate.warnings ?? []);
    } catch (error) {
      dispatch({ type: 'failed', key: 'discount', message: cartErrorMessage('discount') });
      throw error;
    }
  }, [applyMutationSnapshot, finishMutation, snapshotSequencer]);

  const applyDiscountCode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const current = cartRef.current;
    const existing = current?.discountCodes.map((entry) => entry.code) ?? [];
    if (existing.includes(trimmed)) return;
    await updateDiscountCodes([...existing, trimmed]);
  }, [updateDiscountCodes]);

  const removeDiscountCode = useCallback(async (code: string) => {
    const current = cartRef.current;
    const remaining = (current?.discountCodes.map((entry) => entry.code) ?? [])
      .filter((existing) => existing !== code);
    await updateDiscountCodes(remaining);
  }, [updateDiscountCodes]);

  const recoverStaleCart = useCallback(async (): Promise<boolean> => {
    const previous = cartRef.current;
    if (!previous) return false;
    const version = snapshotSequencer.begin();
    dispatch({ type: 'started', key: 'refresh', kind: 'refresh' });
    try {
      const recovered = await rebuildStaleCart(
        previous,
        async (id) => (await storefront<{ cart: Cart | null }>(CART_QUERY, {
          id,
          ...inContextVariables(),
        })).cart,
        createRemoteCartOnly,
      );
      const accepted = applyCartSnapshot(version, recovered);
      if (accepted) await persistId(version, recovered?.id ?? null);
      dispatch({ type: 'completed', key: 'refresh' });
      return accepted && Boolean(recovered);
    } catch (error) {
      dispatch({ type: 'failed', key: 'refresh', message: cartErrorMessage('refresh') });
      throw error;
    }
  }, [applyCartSnapshot, createRemoteCartOnly, persistId, snapshotSequencer]);

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

    // A fresh token every call: tokens rotate on refresh, and `useCheckout`
    // relies on this running right before `present()` to avoid an expired
    // signed-in identity.
    let token: string | null = null;
    if (buyerIdentityTarget.kind === 'customer') {
      token = await getAccessToken();
      current = cartRef.current;
      if (!current?.id) return;
    }
    const tokenFingerprint = token ? fingerprintToken(token) : undefined;
    const synchronizationKey = buyerIdentityKey(current.id, buyerIdentityTarget, tokenFingerprint);
    if (syncedBuyerRef.current === synchronizationKey) return;

    if (
      buyerIdentityTarget.kind === 'guest' &&
      current.buyerIdentity !== undefined &&
      !current.buyerIdentity?.email &&
      (current.buyerIdentity?.countryCode ?? null) === (buyerIdentityTarget.countryCode ?? null)
    ) {
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
          buyerIdentity: buyerIdentityUpdateInput(buyerIdentityTarget, token),
          ...inContextVariables(),
        });
        let result = data.cartBuyerIdentityUpdate;
        if (token && result.userErrors.length) {
          // Shopify rejected the token-based identity (e.g. expired between
          // fetch and mutation) — fall back to the email-based identity so
          // checkout still works, and record it once (not a retry loop: the
          // canonical key below is marked synced either way).
          track('checkout_identity_fallback');
          const fallback = await storefront<CartBuyerIdentityUpdatePayload>(CART_BUYER_IDENTITY_UPDATE, {
            cartId: current.id,
            buyerIdentity: buyerIdentityUpdateInput(buyerIdentityTarget, null),
            ...inContextVariables(),
          });
          result = fallback.cartBuyerIdentityUpdate;
        }
        const next = requireCart(result);
        if (await applyMutationSnapshot(version, next)) markBuyerIdentitySynced(synchronizationKey);
        finishMutation('buyerIdentity', result.warnings ?? []);
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
    applyMutationSnapshot,
    buyerIdentityTarget,
    finishMutation,
    getAccessToken,
    markBuyerIdentitySynced,
    snapshotSequencer,
  ]);

  /**
   * Privacy on shared devices: once a signed-in customer's identity has been
   * associated with the remote cart, signing out must not leave that cart
   * (or its id) behind. Rebuild a fresh guest cart with the same lines and
   * drop the old one, guarded by the snapshot sequencer like every other
   * mutation.
   */
  const rebuildGuestCartOnSignOut = useCallback(async (): Promise<void> => {
    const previous = cartRef.current;
    if (!previous) return;
    const version = snapshotSequencer.begin();
    try {
      const lines = previous.lines.nodes.map(removalUndoInput);
      const next = lines.length ? await createRemoteCartOnly(lines) : null;
      const accepted = applyCartSnapshot(version, next);
      if (accepted) {
        await persistId(version, next?.id ?? null);
        if (next && buyerIdentityTarget.status === 'ready') {
          markBuyerIdentitySynced(buyerIdentityKey(next.id, buyerIdentityTarget));
        }
      }
    } catch (error) {
      captureException(error, { scope: 'cart.signOutGuestRebuild' });
    }
  }, [applyCartSnapshot, buyerIdentityTarget, createRemoteCartOnly, markBuyerIdentitySynced, persistId, snapshotSequencer]);

  useEffect(() => {
    if (buyerIdentityTarget.status !== 'ready') return;
    const previousKind = previousIdentityKindRef.current;
    previousIdentityKindRef.current = buyerIdentityTarget.kind;
    if (!state.cart) return;
    if (previousKind === 'customer' && buyerIdentityTarget.kind === 'guest') {
      void rebuildGuestCartOnSignOut();
      return;
    }
    void syncBuyerIdentity().catch(() => {
      // The operation error remains available for checkout recovery UI.
    });
  }, [buyerIdentityTarget, rebuildGuestCartOnSignOut, state.cart, syncBuyerIdentity]);

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

  const dismissWarnings = useCallback(() => {
    dispatch({ type: 'warningsDismissed' });
  }, []);

  const clearLocal = useCallback(async () => {
    snapshotSequencer.invalidate();
    const version = snapshotSequencer.begin();
    syncedBuyerRef.current = null;
    setSyncedBuyerKey(null);
    cartRef.current = null;
    dispatch({ type: 'reset' });
    await persistId(version, null);
  }, [persistId, snapshotSequencer]);

  const busy = Object.values(state.operations).some((operation) => operation.pending);
  const buyerIdentityReady =
    !state.cart ||
    (buyerIdentityTarget.status === 'ready' &&
      buyerIdentityKeyMatchesTarget(syncedBuyerKey, state.cart.id, buyerIdentityTarget));
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
    warnings: state.warnings,
    dismissWarnings,
    addLine,
    updateLine,
    removeLine,
    undoRemove,
    applyDiscountCode,
    removeDiscountCode,
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
    dismissWarnings,
    addLine,
    updateLine,
    removeLine,
    undoRemove,
    applyDiscountCode,
    removeDiscountCode,
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
