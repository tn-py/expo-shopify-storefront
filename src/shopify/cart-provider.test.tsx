import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { CartProvider, useCart, type CartContextValue } from './cart';
import { storefront } from './client';
import { CART_BUYER_IDENTITY_UPDATE, CART_LINES_UPDATE, CART_QUERY } from './queries';
import type { Cart, CartLine } from './types';

let mockAuthState = {
  ready: true,
  isAuthenticated: false,
  customer: null as null | { id: string | null; firstName: string | null; lastName: string | null; emailAddress: string | null },
};

jest.mock('./auth', () => ({ useAuth: () => mockAuthState }));
jest.mock('./client', () => ({ storefront: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockStorefront = storefront as jest.Mock;
const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const money = { amount: '10.00', currencyCode: 'USD' };
const line = (id: string, quantity: number): CartLine => ({
  id,
  quantity,
  cost: {
    totalAmount: { amount: String(10 * quantity), currencyCode: 'USD' },
    amountPerQuantity: money,
  },
  merchandise: {
    id: `variant-${id}`,
    title: id,
    image: null,
    product: { handle: id, title: id },
    selectedOptions: [],
    price: money,
  },
});

function makeCart(
  firstQuantity = 1,
  secondQuantity = 1,
  buyerEmail: string | null = null,
): Cart {
  const nodes = [line('line-1', firstQuantity), line('line-2', secondQuantity)];
  return {
    id: 'cart-1',
    checkoutUrl: 'https://shop.example/checkouts/1',
    totalQuantity: firstQuantity + secondQuantity,
    buyerIdentity: { email: buyerEmail },
    cost: { subtotalAmount: money, totalAmount: money, totalTaxAmount: null },
    lines: { nodes },
  };
}

let latestCartContext: CartContextValue | null = null;

function Probe() {
  const context = useCart();
  useEffect(() => {
    latestCartContext = context;
  }, [context]);
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  latestCartContext = null;
  mockAuthState = { ready: true, isAuthenticated: false, customer: null };
  mockStorage.getItem.mockResolvedValue('cart-1');
});

describe('CartProvider identity synchronization', () => {
  it('waits for a delayed signed-in profile and synchronizes its email before becoming checkout-ready', async () => {
    mockAuthState = { ready: true, isAuthenticated: true, customer: null };
    mockStorefront.mockImplementation(async (operation: string) => {
      if (operation === CART_QUERY) return { cart: makeCart(1, 1, null) };
      if (operation === CART_BUYER_IDENTITY_UPDATE) {
        return { cartBuyerIdentityUpdate: { cart: makeCart(1, 1, 'member@example.com'), userErrors: [] } };
      }
      throw new Error('unexpected operation');
    });
    const view = await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.ready).toBe(true));
    expect(latestCartContext?.buyerIdentityResolved).toBe(false);
    expect(latestCartContext?.buyerIdentityReady).toBe(false);

    mockAuthState = {
      ready: true,
      isAuthenticated: true,
      customer: { id: 'customer-1', firstName: 'M', lastName: null, emailAddress: 'member@example.com' },
    };
    await view.rerender(<CartProvider><Probe /></CartProvider>);

    await waitFor(() => expect(latestCartContext?.buyerIdentityReady).toBe(true));
    expect(latestCartContext?.buyerIdentityResolved).toBe(true);
    expect(mockStorefront).toHaveBeenCalledWith(CART_BUYER_IDENTITY_UPDATE, {
      cartId: 'cart-1',
      buyerIdentity: { email: 'member@example.com' },
    });
  });

  it('clears a prior member email on sign-out before guest checkout can proceed', async () => {
    mockAuthState = {
      ready: true,
      isAuthenticated: true,
      customer: { id: 'customer-1', firstName: 'M', lastName: null, emailAddress: 'member@example.com' },
    };
    mockStorefront.mockImplementation(async (operation: string, variables: Record<string, unknown>) => {
      if (operation === CART_QUERY) return { cart: makeCart(1, 1, 'member@example.com') };
      if (operation === CART_BUYER_IDENTITY_UPDATE) {
        expect(variables.buyerIdentity).toEqual({ email: null });
        return { cartBuyerIdentityUpdate: { cart: makeCart(1, 1, null), userErrors: [] } };
      }
      throw new Error('unexpected operation');
    });
    const view = await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.buyerIdentityReady).toBe(true));

    mockAuthState = { ready: true, isAuthenticated: false, customer: null };
    await view.rerender(<CartProvider><Probe /></CartProvider>);

    await waitFor(() => expect(latestCartContext?.buyerIdentityReady).toBe(true));
    expect(mockStorefront).toHaveBeenCalledWith(CART_BUYER_IDENTITY_UPDATE, {
      cartId: 'cart-1',
      buyerIdentity: { email: null },
    });
    await expect(latestCartContext!.syncBuyerIdentity()).resolves.toBeUndefined();
  });
});

describe('CartProvider snapshot ordering', () => {
  it('does not let a mutation started before clearLocal restore the cleared cart', async () => {
    let persistedCartId: string | null = 'cart-1';
    let resolveUpdate!: (value: unknown) => void;
    let cartQueryCount = 0;
    mockStorage.getItem.mockImplementation(async () => persistedCartId);
    mockStorage.setItem.mockImplementation(async (_key, value) => {
      persistedCartId = value;
    });
    mockStorage.removeItem.mockImplementation(async () => {
      persistedCartId = null;
    });
    mockStorefront.mockImplementation((operation: string) => {
      if (operation === CART_QUERY) {
        cartQueryCount += 1;
        return Promise.resolve({ cart: makeCart(2, 1) });
      }
      if (operation === CART_LINES_UPDATE) {
        return new Promise((resolve) => { resolveUpdate = resolve; });
      }
      throw new Error('unexpected operation');
    });
    await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.ready).toBe(true));

    let update!: Promise<void>;
    await act(async () => {
      update = latestCartContext!.updateLine('line-1', 4);
      await Promise.resolve();
    });
    await waitFor(() => expect(resolveUpdate).toBeDefined());
    await act(async () => {
      await latestCartContext!.clearLocal();
    });

    await act(async () => {
      resolveUpdate({ cartLinesUpdate: { cart: makeCart(4, 1), userErrors: [] } });
      await update;
    });

    expect(latestCartContext!.cart).toBeNull();
    expect(persistedCartId).toBeNull();
    expect(cartQueryCount).toBe(1);
  });

  it('reconciles an older cross-line response so both successful mutations remain visible', async () => {
    const pending = new Map<string, (value: unknown) => void>();
    let cartQueryCount = 0;
    mockStorefront.mockImplementation((operation: string, variables: { lines?: { id: string }[] }) => {
      if (operation === CART_QUERY) {
        cartQueryCount += 1;
        return Promise.resolve({ cart: cartQueryCount === 1 ? makeCart() : makeCart(2, 3) });
      }
      if (operation === CART_LINES_UPDATE) {
        const id = variables.lines![0].id;
        return new Promise((resolve) => pending.set(id, resolve));
      }
      throw new Error('unexpected operation');
    });
    await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.ready).toBe(true));

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = latestCartContext!.updateLine('line-1', 2);
      second = latestCartContext!.updateLine('line-2', 3);
      await Promise.resolve();
    });
    await waitFor(() => expect(pending.size).toBe(2));

    await act(async () => {
      pending.get('line-2')!({ cartLinesUpdate: { cart: makeCart(1, 3), userErrors: [] } });
      await second;
    });
    expect(latestCartContext!.cart?.lines.nodes.map((item) => item.quantity)).toEqual([1, 3]);

    await act(async () => {
      pending.get('line-1')!({ cartLinesUpdate: { cart: makeCart(2, 1), userErrors: [] } });
      await first;
    });
    expect(latestCartContext!.cart?.lines.nodes.map((item) => item.quantity)).toEqual([2, 3]);
    expect(cartQueryCount).toBe(2);
  });
});
