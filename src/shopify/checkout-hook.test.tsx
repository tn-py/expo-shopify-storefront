import { render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { useCheckout } from './checkout';
import { useCart } from './cart';
import type { Cart } from './types';

const mockCheckout = {
  preload: jest.fn(),
  present: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

jest.mock('@shopify/checkout-sheet-kit', () => ({
  CheckoutExpiredError: class CheckoutExpiredError extends Error {},
  useShopifyCheckoutSheet: () => mockCheckout,
}));
jest.mock('./cart', () => ({ useCart: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const mockUseCart = useCart as jest.Mock;
const money = { amount: '20.00', currencyCode: 'USD' };
const cart: Cart = {
  id: 'cart-1',
  checkoutUrl: 'https://shop.example/checkouts/1',
  totalQuantity: 1,
  buyerIdentity: { email: null },
  cost: { subtotalAmount: money, totalAmount: money, totalTaxAmount: null },
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
