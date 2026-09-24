import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { track } from '@/lib/analytics';
import { CheckoutEvents, useCheckout } from './checkout';
import { useCart } from './cart';
import type { Cart } from './types';

const mockCheckout = {
  preload: jest.fn(),
  present: jest.fn(),
  addEventListener: jest.fn((..._args: unknown[]) => ({ remove: jest.fn() })),
};
const mockReplace = jest.fn();

jest.mock('@shopify/checkout-sheet-kit', () => ({
  CheckoutExpiredError: class CheckoutExpiredError extends Error {},
  useShopifyCheckoutSheet: () => mockCheckout,
}));
jest.mock('./cart', () => ({ useCart: jest.fn() }));
jest.mock('./auth', () => ({
  useAuth: () => ({ isAuthenticated: false, getAccessToken: jest.fn(async () => null) }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockUseCart = useCart as jest.Mock;
const mockTrack = track as jest.Mock;
const money = { amount: '20.00', currencyCode: 'USD' };
const cart: Cart = {
  id: 'cart-1',
  checkoutUrl: 'https://shop.example/checkouts/1',
  totalQuantity: 1,
  buyerIdentity: { email: null, countryCode: 'US' },
  discountCodes: [],
  discountAllocations: [],
  cost: { subtotalAmount: money, totalAmount: money },
  lines: { nodes: [] },
};

let latestCheckout: ReturnType<typeof useCheckout> | null = null;

function Probe() {
  const checkout = useCheckout();
  useEffect(() => {
    latestCheckout = checkout;
  }, [checkout]);
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  latestCheckout = null;
});

it('keeps both canCheckout and startCheckout blocked until buyer identity sync completes', async () => {
  const syncBuyerIdentity = jest.fn().mockResolvedValue(undefined);
  mockUseCart.mockReturnValue({
    cart,
    operations: { buyerIdentity: { kind: 'buyerIdentity', pending: true, error: null } },
    recoverStaleCart: jest.fn(),
    syncBuyerIdentity,
    buyerIdentityResolved: true,
    buyerIdentityReady: false,
  });
  await render(<Probe />);
  await waitFor(() => expect(latestCheckout).not.toBeNull());

  expect(latestCheckout!.canCheckout).toBe(false);
  expect(latestCheckout!.startCheckout()).toBe(false);
  expect(syncBuyerIdentity).not.toHaveBeenCalled();
  expect(mockCheckout.present).not.toHaveBeenCalled();
});

it('keeps checkout blocked after identity sync failure until an explicit retry recovers', async () => {
  const syncBuyerIdentity = jest.fn().mockResolvedValue(undefined);
  const failed = {
    cart,
    operations: { buyerIdentity: { kind: 'buyerIdentity', pending: false, error: 'sync failed' } },
    recoverStaleCart: jest.fn(),
    syncBuyerIdentity,
    buyerIdentityResolved: true,
    buyerIdentityReady: false,
  };
  mockUseCart.mockReturnValue(failed);
  const view = await render(<Probe />);
  await waitFor(() => expect(latestCheckout?.canCheckout).toBe(false));
  expect(latestCheckout!.startCheckout()).toBe(false);

  mockUseCart.mockReturnValue({
    ...failed,
    operations: {},
    buyerIdentityReady: true,
  });
  await view.rerender(<Probe />);
  await waitFor(() => expect(latestCheckout?.canCheckout).toBe(true));
});

it('tracks completed purchases with a numeric amount and currency while keeping display total in navigation', async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  mockCheckout.addEventListener.mockImplementation((event?: unknown, listener?: unknown) => {
    if (typeof event === 'string' && typeof listener === 'function') {
      listeners.set(event, listener as (event: unknown) => void);
    }
    return { remove: jest.fn() };
  });
  const clearLocal = jest.fn().mockResolvedValue(undefined);
  mockUseCart.mockReturnValue({ clearLocal });
  await render(<CheckoutEvents />);
  await waitFor(() => expect(listeners.has('completed')).toBe(true));

  await act(async () => {
    listeners.get('completed')!({
      orderDetails: {
        id: 'gid://shopify/Order/123',
        email: 'member@example.com',
        cart: { price: { total: { amount: 48, currencyCode: 'USD' } } },
      },
    });
    await Promise.resolve();
  });

  expect(mockTrack).toHaveBeenCalledWith('purchase', {
    order_id: 'gid://shopify/Order/123',
    total: 48,
    currency: 'USD',
  });
  expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({
    pathname: '/order-confirmed',
    params: expect.objectContaining({ displayTotal: '$48.00' }),
  }));
});
