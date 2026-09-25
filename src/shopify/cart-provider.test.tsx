import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { CartProvider, useCart, type CartContextValue } from './cart';
import { storefront } from './client';
import {
  CART_BUYER_IDENTITY_UPDATE,
  CART_CREATE,
  CART_DISCOUNT_CODES_UPDATE,
  CART_LINES_UPDATE,
  CART_QUERY,
} from './queries';
import type { Cart, CartLine } from './types';

let mockAuthState = {
  ready: true,
  isAuthenticated: false,
  customer: null as null | { id: string | null; firstName: string | null; lastName: string | null; emailAddress: string | null },
  customerProfileStatus: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
  customerProfileError: null as string | null,
  retryCustomerProfile: jest.fn(),
  getAccessToken: jest.fn(async () => null as string | null),
};

jest.mock('./auth', () => ({ useAuth: () => mockAuthState }));
jest.mock('./client', () => ({ storefront: jest.fn() }));
jest.mock('./locale', () => ({
  storefrontLocale: { country: 'US', language: 'EN' },
  inContextVariables: () => ({ country: 'US', language: 'EN' }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
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
  discountAllocations: [],
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
  id = 'cart-1',
): Cart {
  const nodes = [line('line-1', firstQuantity), line('line-2', secondQuantity)];
  return {
    id,
    checkoutUrl: `https://shop.example/checkouts/${id}`,
    totalQuantity: firstQuantity + secondQuantity,
    buyerIdentity: { email: buyerEmail, countryCode: 'US' },
    discountCodes: [],
    discountAllocations: [],
    cost: { subtotalAmount: money, totalAmount: money },
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
  mockAuthState = {
    ready: true,
    isAuthenticated: false,
    customer: null,
    customerProfileStatus: 'idle',
    customerProfileError: null,
    retryCustomerProfile: jest.fn(),
    getAccessToken: jest.fn(async () => null),
  };
  mockStorage.getItem.mockResolvedValue('cart-1');
});

describe('CartProvider identity synchronization', () => {
  it('waits for a delayed signed-in profile and synchronizes a fresh customer access token before becoming checkout-ready', async () => {
    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      customerProfileStatus: 'idle',
    };
    mockStorefront.mockImplementation(async (operation: string) => {
      if (operation === CART_QUERY) return { cart: makeCart(1, 1, null) };
      if (operation === CART_BUYER_IDENTITY_UPDATE) {
        return { cartBuyerIdentityUpdate: { cart: makeCart(1, 1, 'member@example.com'), userErrors: [], warnings: [] } };
      }
      throw new Error('unexpected operation');
    });
    const view = await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.ready).toBe(true));
    expect(latestCartContext?.buyerIdentityResolved).toBe(false);
    expect(latestCartContext?.buyerIdentityReady).toBe(false);

    mockAuthState = {
      ...mockAuthState,
      customer: { id: 'customer-1', firstName: 'M', lastName: null, emailAddress: 'member@example.com' },
      customerProfileStatus: 'ready',
      getAccessToken: jest.fn(async () => 'token-1'),
    };
    await view.rerender(<CartProvider><Probe /></CartProvider>);

    await waitFor(() => expect(latestCartContext?.buyerIdentityReady).toBe(true));
    expect(latestCartContext?.buyerIdentityResolved).toBe(true);
    expect(mockStorefront).toHaveBeenCalledWith(CART_BUYER_IDENTITY_UPDATE, {
      cartId: 'cart-1',
      buyerIdentity: { customerAccessToken: 'token-1', countryCode: 'US' },
      country: 'US',
      language: 'EN',
    });
  });

  it('falls back to the email-based identity and tracks it once when Shopify rejects the token', async () => {
    const { track } = jest.requireMock('@/lib/analytics') as { track: jest.Mock };
    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      customer: { id: 'customer-1', firstName: 'M', lastName: null, emailAddress: 'member@example.com' },
      customerProfileStatus: 'ready',
      getAccessToken: jest.fn(async () => 'stale-token'),
    };
    let tokenAttempts = 0;
    mockStorefront.mockImplementation(async (operation: string, variables: { buyerIdentity?: Record<string, unknown> }) => {
      if (operation === CART_QUERY) return { cart: makeCart(1, 1, null) };
      if (operation === CART_BUYER_IDENTITY_UPDATE) {
        if (variables.buyerIdentity?.customerAccessToken) {
          tokenAttempts += 1;
          return { cartBuyerIdentityUpdate: { cart: null, userErrors: [{ message: 'Token invalid' }], warnings: [] } };
        }
        expect(variables.buyerIdentity).toEqual({ email: 'member@example.com', countryCode: 'US' });
        return { cartBuyerIdentityUpdate: { cart: makeCart(1, 1, 'member@example.com'), userErrors: [], warnings: [] } };
      }
      throw new Error('unexpected operation');
    });

    await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.buyerIdentityReady).toBe(true));

    expect(tokenAttempts).toBe(1);
    expect(track).toHaveBeenCalledWith('checkout_identity_fallback');

    // The canonical (token-based) key is marked synced even though the token
    // attempt failed, so a repeat sync with the same token doesn't loop.
    track.mockClear();
    mockStorefront.mockClear();
    await act(async () => {
      await latestCartContext!.syncBuyerIdentity();
    });
    expect(mockStorefront).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('rebuilds a fresh guest cart with the same lines on sign-out so it carries no signed-in identity', async () => {
    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      customer: { id: 'customer-1', firstName: 'M', lastName: null, emailAddress: 'member@example.com' },
      customerProfileStatus: 'ready',
      getAccessToken: jest.fn(async () => 'token-1'),
    };
    let persistedCartId: string | null = 'cart-1';
    mockStorage.setItem.mockImplementation(async (_key, value) => { persistedCartId = value; });
    mockStorage.removeItem.mockImplementation(async () => { persistedCartId = null; });
    mockStorefront.mockImplementation(async (operation: string, variables: { buyerIdentity?: Record<string, unknown>; lines?: unknown[] }) => {
      if (operation === CART_QUERY) return { cart: makeCart(1, 1, 'member@example.com') };
      if (operation === CART_BUYER_IDENTITY_UPDATE) {
        return { cartBuyerIdentityUpdate: { cart: makeCart(1, 1, 'member@example.com'), userErrors: [], warnings: [] } };
      }
      if (operation === CART_CREATE) {
        expect(variables.buyerIdentity).toEqual({ countryCode: 'US' });
        expect(variables.lines).toEqual([
          { merchandiseId: 'variant-line-1', quantity: 1 },
          { merchandiseId: 'variant-line-2', quantity: 1 },
        ]);
        return { cartCreate: { cart: makeCart(1, 1, null, 'cart-2'), userErrors: [], warnings: [] } };
      }
      throw new Error('unexpected operation');
    });
    const view = await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.buyerIdentityReady).toBe(true));
    expect(latestCartContext?.cart?.id).toBe('cart-1');

    mockAuthState = { ...mockAuthState, isAuthenticated: false, customer: null, customerProfileStatus: 'idle' };
    await view.rerender(<CartProvider><Probe /></CartProvider>);

    await waitFor(() => expect(latestCartContext?.cart?.id).toBe('cart-2'));
    expect(persistedCartId).toBe('cart-2');
    expect(latestCartContext?.buyerIdentityReady).toBe(true);
  });

  it('drops the signed-in cart from the device when the guest rebuild fails on sign-out', async () => {
    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      customer: { id: 'customer-1', firstName: 'M', lastName: null, emailAddress: 'member@example.com' },
      customerProfileStatus: 'ready',
      getAccessToken: jest.fn(async () => 'token-1'),
    };
    let persistedCartId: string | null = 'cart-1';
    mockStorage.setItem.mockImplementation(async (_key, value) => { persistedCartId = value; });
    mockStorage.removeItem.mockImplementation(async () => { persistedCartId = null; });
    mockStorefront.mockImplementation(async (operation: string) => {
      if (operation === CART_QUERY) return { cart: makeCart(1, 1, 'member@example.com') };
      if (operation === CART_BUYER_IDENTITY_UPDATE) {
        return { cartBuyerIdentityUpdate: { cart: makeCart(1, 1, 'member@example.com'), userErrors: [], warnings: [] } };
      }
      if (operation === CART_CREATE) throw new Error('offline');
      throw new Error('unexpected operation');
    });
    const view = await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.buyerIdentityReady).toBe(true));

    mockAuthState = { ...mockAuthState, isAuthenticated: false, customer: null, customerProfileStatus: 'idle' };
    await view.rerender(<CartProvider><Probe /></CartProvider>);

    await waitFor(() => expect(latestCartContext?.cart).toBeNull());
    expect(persistedCartId).toBeNull();
  });
});

describe('CartProvider discount codes', () => {
  it('applies a discount code while preserving other applied codes and normalizing whitespace', async () => {
    mockStorage.getItem.mockResolvedValue('cart-1');
    mockStorefront.mockImplementation(async (operation: string, variables: { discountCodes?: string[] }) => {
      if (operation === CART_QUERY) {
        return { cart: { ...makeCart(1, 1, null), discountCodes: [{ code: 'WELCOME10', applicable: true }] } };
      }
      if (operation === CART_DISCOUNT_CODES_UPDATE) {
        expect(variables.discountCodes).toEqual(['WELCOME10', 'SUMMER']);
        return {
          cartDiscountCodesUpdate: {
            cart: {
              ...makeCart(1, 1, null),
              discountCodes: [
                { code: 'WELCOME10', applicable: true },
                { code: 'SUMMER', applicable: false },
              ],
            },
            userErrors: [],
            warnings: [],
          },
        };
      }
      throw new Error('unexpected operation');
    });
    await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.ready).toBe(true));

    await act(async () => {
      await latestCartContext!.applyDiscountCode('  summer  '.trim().toUpperCase());
    });

    expect(latestCartContext?.cart?.discountCodes).toEqual([
      { code: 'WELCOME10', applicable: true },
      { code: 'SUMMER', applicable: false },
    ]);
  });

  it('removes a discount code while keeping the others applied', async () => {
    mockStorage.getItem.mockResolvedValue('cart-1');
    mockStorefront.mockImplementation(async (operation: string, variables: { discountCodes?: string[] }) => {
      if (operation === CART_QUERY) {
        return {
          cart: {
            ...makeCart(1, 1, null),
            discountCodes: [
              { code: 'WELCOME10', applicable: true },
              { code: 'SUMMER', applicable: false },
            ],
          },
        };
      }
      if (operation === CART_DISCOUNT_CODES_UPDATE) {
        expect(variables.discountCodes).toEqual(['WELCOME10']);
        return {
          cartDiscountCodesUpdate: {
            cart: { ...makeCart(1, 1, null), discountCodes: [{ code: 'WELCOME10', applicable: true }] },
            userErrors: [],
            warnings: [],
          },
        };
      }
      throw new Error('unexpected operation');
    });
    await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.ready).toBe(true));

    await act(async () => {
      await latestCartContext!.removeDiscountCode('SUMMER');
    });

    expect(latestCartContext?.cart?.discountCodes).toEqual([{ code: 'WELCOME10', applicable: true }]);
  });
});

describe('CartProvider warnings', () => {
  it('surfaces non-blocking mutation warnings and clears them on dismissal', async () => {
    mockStorage.getItem.mockResolvedValue(null);
    mockStorefront.mockImplementation(async (operation: string) => {
      if (operation === CART_CREATE) {
        return {
          cartCreate: {
            cart: makeCart(1, 1, null),
            userErrors: [],
            warnings: [{ code: 'LINE_QUANTITY_ADJUSTED', message: 'We adjusted a quantity for stock.', target: 'line-1' }],
          },
        };
      }
      throw new Error('unexpected operation');
    });
    await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.ready).toBe(true));

    await act(async () => {
      await latestCartContext!.addLine('variant-1');
    });

    expect(latestCartContext?.warnings).toEqual([
      { code: 'LINE_QUANTITY_ADJUSTED', message: 'We adjusted a quantity for stock.', target: 'line-1' },
    ]);

    await act(async () => {
      latestCartContext!.dismissWarnings();
    });
    expect(latestCartContext?.warnings).toEqual([]);
  });
});

describe('CartProvider snapshot ordering', () => {
  it('keeps a new cart ID when an old create persistence finishes after a clear', async () => {
    let persistedCartId: string | null = null;
    let releaseOldSet!: () => void;
    let createCount = 0;
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.setItem.mockImplementation(async (_key, value) => {
      if (value === 'cart-old') {
        await new Promise<void>((resolve) => { releaseOldSet = resolve; });
      }
      persistedCartId = value;
    });
    mockStorage.removeItem.mockImplementation(async () => {
      persistedCartId = null;
    });
    mockStorefront.mockImplementation(async (operation: string) => {
      if (operation === CART_CREATE) {
        createCount += 1;
        const id = createCount === 1 ? 'cart-old' : 'cart-new';
        return { cartCreate: { cart: makeCart(1, 1, null, id), userErrors: [], warnings: [] } };
      }
      throw new Error('unexpected operation');
    });
    await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.ready).toBe(true));

    let oldAdd!: Promise<void>;
    await act(async () => {
      oldAdd = latestCartContext!.addLine('variant-old');
      await Promise.resolve();
    });
    await waitFor(() => expect(releaseOldSet).toBeDefined());

    let clear!: Promise<void>;
    let newAdd!: Promise<void>;
    await act(async () => {
      clear = latestCartContext!.clearLocal();
      newAdd = latestCartContext!.addLine('variant-new');
      await Promise.resolve();
    });
    await waitFor(() => expect(createCount).toBe(2));

    await act(async () => {
      releaseOldSet();
      await Promise.all([oldAdd, clear, newAdd]);
    });

    expect(latestCartContext!.cart?.id).toBe('cart-new');
    expect(persistedCartId).toBe('cart-new');
  });

  it('keeps a new cart ID when a delayed clear persistence finishes later', async () => {
    let persistedCartId: string | null = null;
    let releaseClear!: () => void;
    mockStorage.getItem.mockResolvedValue(null);
    mockStorage.setItem.mockImplementation(async (_key, value) => {
      persistedCartId = value;
    });
    mockStorage.removeItem.mockImplementation(async () => {
      await new Promise<void>((resolve) => { releaseClear = resolve; });
      persistedCartId = null;
    });
    mockStorefront.mockImplementation(async (operation: string) => {
      if (operation === CART_CREATE) {
        return {
          cartCreate: {
            cart: makeCart(1, 1, null, 'cart-new'),
            userErrors: [],
            warnings: [],
          },
        };
      }
      throw new Error('unexpected operation');
    });
    await render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(latestCartContext?.ready).toBe(true));

    let clear!: Promise<void>;
    let newAdd!: Promise<void>;
    await act(async () => {
      clear = latestCartContext!.clearLocal();
      newAdd = latestCartContext!.addLine('variant-new');
      await Promise.resolve();
    });
    await waitFor(() => expect(releaseClear).toBeDefined());
    await waitFor(() => expect(mockStorefront).toHaveBeenCalledWith(CART_CREATE, expect.any(Object)));

    await act(async () => {
      releaseClear();
      await Promise.all([clear, newAdd]);
    });

    expect(latestCartContext!.cart?.id).toBe('cart-new');
    expect(persistedCartId).toBe('cart-new');
  });

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
      resolveUpdate({ cartLinesUpdate: { cart: makeCart(4, 1), userErrors: [], warnings: [] } });
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
      pending.get('line-2')!({ cartLinesUpdate: { cart: makeCart(1, 3), userErrors: [], warnings: [] } });
      await second;
    });
    expect(latestCartContext!.cart?.lines.nodes.map((item) => item.quantity)).toEqual([1, 3]);

    await act(async () => {
      pending.get('line-1')!({ cartLinesUpdate: { cart: makeCart(2, 1), userErrors: [], warnings: [] } });
      await first;
    });
    expect(latestCartContext!.cart?.lines.nodes.map((item) => item.quantity)).toEqual([2, 3]);
    expect(cartQueryCount).toBe(2);
  });
});
