import { fireEvent, render } from '@testing-library/react-native';

import CartScreen from '@/app/(tabs)/cart';
import OrderConfirmedScreen from '@/app/order-confirmed';
import type { Cart } from '@/shopify/types';

let mockParams: Record<string, string | undefined> = {};
let mockAuthenticated = false;

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/shopify/auth', () => ({
  useAuth: () => ({ isAuthenticated: mockAuthenticated }),
}));
jest.mock('@/shopify/cart', () => ({ useCart: jest.fn() }));
jest.mock('@/shopify/checkout', () => ({ useCheckout: jest.fn() }));

const cartModule = jest.requireMock('@/shopify/cart') as { useCart: jest.Mock };
const checkoutModule = jest.requireMock('@/shopify/checkout') as { useCheckout: jest.Mock };
const money = { amount: '20.00', currencyCode: 'USD' };
const cart: Cart = {
  id: 'cart-1',
  checkoutUrl: 'https://shop.example/checkouts/1',
  totalQuantity: 1,
  cost: { subtotalAmount: money, totalAmount: money, totalTaxAmount: null },
  lines: {
    nodes: [{
      id: 'line-1',
      quantity: 1,
      cost: { totalAmount: money, amountPerQuantity: money },
      merchandise: {
        id: 'variant-1',
        title: 'Default Title',
        image: null,
        product: { handle: 'shirt', title: 'Everyday shirt' },
        selectedOptions: [{ name: 'Title', value: 'Default Title' }],
        price: money,
      },
    }],
  },
};

describe('cart conversion states', () => {
  beforeEach(() => {
    cartModule.useCart.mockReturnValue({
      cart,
      ready: true,
      busy: false,
      operations: {},
      lastRemovedLine: null,
      updateLine: jest.fn(),
      removeLine: jest.fn(),
      undoRemove: jest.fn(),
      clearOperationError: jest.fn(),
      buyerIdentityError: null,
      buyerIdentityErrorKind: null,
      retryBuyerIdentity: jest.fn(),
    });
    checkoutModule.useCheckout.mockReturnValue({
      canCheckout: true,
      startCheckout: jest.fn(),
      presenting: false,
      error: null,
      recovered: false,
    });
  });

  it('labels the cart total as estimated and keeps Shopify authoritative', async () => {
    const { getAllByText, getByText } = await render(<CartScreen />);

    expect(getAllByText('Estimated total')).toHaveLength(2);
    expect(getByText(/taxes, shipping, and discounts are finalized in Shopify Checkout/i)).toBeOnTheScreen();
  });

  it('offers undo after a successful removal', async () => {
    cartModule.useCart.mockReturnValue({
      ...cartModule.useCart(),
      lastRemovedLine: cart.lines.nodes[0],
    });
    const { getByRole } = await render(<CartScreen />);

    expect(getByRole('button', { name: 'Undo remove' })).toBeOnTheScreen();
  });

  it('keeps undo available when removing the final cart line', async () => {
    cartModule.useCart.mockReturnValue({
      ...cartModule.useCart(),
      cart: { ...cart, totalQuantity: 0, lines: { nodes: [] } },
      lastRemovedLine: cart.lines.nodes[0],
    });
    const { getByRole } = await render(<CartScreen />);

    expect(getByRole('button', { name: 'Undo remove' })).toBeOnTheScreen();
  });

  it('accumulates rapid quantity taps while the first server update is pending', async () => {
    const updateLine = jest.fn(() => new Promise<void>(() => undefined));
    cartModule.useCart.mockReturnValue({
      ...cartModule.useCart(),
      updateLine,
      operations: {},
    });
    const { getByRole, getByLabelText } = await render(<CartScreen />);

    await fireEvent.press(getByRole('button', { name: 'Increase quantity' }));
    await fireEvent.press(getByRole('button', { name: 'Increase quantity' }));
    await fireEvent.press(getByRole('button', { name: 'Increase quantity' }));

    expect(getByLabelText('Quantity 4')).toBeOnTheScreen();
    expect((updateLine.mock.calls as unknown as [string, number][]).map((call) => call[1])).toEqual([2, 3, 4]);
  });

  it('shows actionable retry feedback when the customer profile cannot load', async () => {
    const retryBuyerIdentity = jest.fn();
    cartModule.useCart.mockReturnValue({
      ...cartModule.useCart(),
      buyerIdentityError: 'We couldn’t load your customer profile. Check your connection and try again.',
      buyerIdentityErrorKind: 'profile',
      retryBuyerIdentity,
    });
    const { getByText, getByRole } = await render(<CartScreen />);

    expect(getByText(/couldn’t load your customer profile/i)).toBeOnTheScreen();
    await fireEvent.press(getByRole('button', { name: 'Retry customer profile' }));
    expect(retryBuyerIdentity).toHaveBeenCalledTimes(1);
  });
});

describe('order confirmation', () => {
  beforeEach(() => {
    mockParams = {
      orderId: 'gid://shopify/Order/1234',
      orderName: '#1007',
      displayTotal: '$48.00',
      customerEmail: 'guest@example.com',
    };
    mockAuthenticated = false;
  });

  it('gives guests email-based order guidance without claiming account tracking', async () => {
    const { getByText, queryByText } = await render(<OrderConfirmedScreen />);

    expect(getByText('#1007')).toBeOnTheScreen();
    expect(getByText('$48.00')).toBeOnTheScreen();
    expect(getByText(/guest@example.com/i)).toBeOnTheScreen();
    expect(queryByText(/track it from your account/i)).toBeNull();
    expect(queryByText('View your orders')).toBeNull();
  });

  it('offers signed-in members a direct route to their order history', async () => {
    mockAuthenticated = true;
    const { getByRole } = await render(<OrderConfirmedScreen />);

    expect(getByRole('button', { name: 'View your orders' })).toBeOnTheScreen();
  });
});
