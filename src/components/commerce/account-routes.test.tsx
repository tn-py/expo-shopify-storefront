import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import AccountScreen from '@/app/(tabs)/account';
import AddressesScreen from '@/app/account/addresses';
import OrderDetailScreen from '@/app/account/order/[id]';
import OrdersScreen from '@/app/account/orders';
import { OrderCard } from '@/components/ui';

let mockOrderId = encodeURIComponent('gid://shopify/Order/123');
const mockSignOut = jest.fn();
const mockSignIn = jest.fn();
let mockAuthenticated = false;
let mockManagementUrl = 'https://accounts.example.com/addresses';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: mockOrderId }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/shopify/auth', () => ({
  useAuth: () => ({
    ready: true,
    isAuthenticated: mockAuthenticated,
    customer: mockAuthenticated ? {
      id: 'gid://shopify/Customer/1',
      firstName: 'Morgan',
      lastName: 'Lee',
      emailAddress: 'morgan@example.com',
    } : null,
    customerProfileStatus: mockAuthenticated ? 'ready' : 'idle',
    customerProfileError: null,
    customerSessionKey: mockAuthenticated ? 'gid://shopify/Customer/1' : null,
    getAccessToken: jest.fn(),
    signIn: mockSignIn,
    signOut: mockSignOut,
    retryCustomerProfile: jest.fn(),
  }),
}));
jest.mock('@/shopify/env', () => ({
  isCustomerAccountConfigured: true,
  ShopifyEnv: {
    get customerAccountManagementUrl() { return mockManagementUrl; },
  },
}));
jest.mock('@/shopify/hooks', () => ({
  useShop: () => ({ data: { name: 'Studio' } }),
}));
jest.mock('@/notifications/onesignal', () => ({
  isPushConfigured: false,
  getPushPermission: jest.fn(),
  requestPushPermission: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/shopify/customer', () => ({
  useAddresses: jest.fn(),
  useOrders: jest.fn(),
  useOrder: jest.fn(),
}));
jest.mock('@/shopify/cart', () => ({ useCart: jest.fn() }));

const customer = jest.requireMock('@/shopify/customer') as {
  useAddresses: jest.Mock;
  useOrders: jest.Mock;
  useOrder: jest.Mock;
};
const cart = jest.requireMock('@/shopify/cart') as { useCart: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockOrderId = encodeURIComponent('gid://shopify/Order/123');
  mockAuthenticated = false;
  mockManagementUrl = 'https://accounts.example.com/addresses';
  mockSignOut.mockResolvedValue(undefined);
  mockSignIn.mockResolvedValue(undefined);
  delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
});

it('disables the protected-route sign-in action while OAuth is opening', async () => {
  let finishSignIn!: () => void;
  mockSignIn.mockReturnValue(new Promise<void>((resolve) => { finishSignIn = resolve; }));
  const view = await render(<OrdersScreen />);

  const firstPress = fireEvent.press(view.getByRole('button', { name: 'Sign in' }));
  const opening = await view.findByRole('button', { name: 'Opening sign in…' });
  expect(opening).toBeDisabled();
  const secondPress = fireEvent.press(opening);

  await act(async () => {
    finishSignIn();
    await Promise.all([firstPress, secondPress]);
  });
  expect(mockSignIn).toHaveBeenCalledTimes(1);
});

it('hides an insecure HTTP hosted address-management handoff', async () => {
  mockAuthenticated = true;
  mockManagementUrl = 'http://accounts.example.com/addresses';
  customer.useAddresses.mockReturnValue({
    data: {
      pages: [{
        customer: {
          defaultAddress: null,
          addresses: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }],
    },
    error: null,
    isPending: false,
    isError: false,
    isRefetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    hasNextPage: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
  });

  const view = await render(<AddressesScreen />);

  expect(view.queryByRole('button', { name: 'Manage addresses online' })).toBeNull();
});

it('hides order support for an invalid header-injecting configured email', async () => {
  mockAuthenticated = true;
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL = 'support@example.com\r\nBcc:attacker@example.com';
  customer.useOrder.mockReturnValue({
    data: {
      id: 'gid://shopify/Order/123',
      name: '#1001',
      processedAt: '2026-08-20T12:00:00Z',
      cancelledAt: null,
      financialStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      subtotal: { amount: '40.00', currencyCode: 'USD' },
      totalShipping: { amount: '2.00', currencyCode: 'USD' },
      totalTax: null,
      totalRefunded: { amount: '0.00', currencyCode: 'USD' },
      totalPrice: { amount: '42.00', currencyCode: 'USD' },
      shippingAddress: null,
      fulfillments: { nodes: [] },
      lineItems: { edges: [] },
    },
    error: null,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });
  cart.useCart.mockReturnValue({ addLine: jest.fn() });

  const view = await render(<OrderDetailScreen />);

  expect(view.queryByRole('button', { name: 'Contact support about this order' })).toBeNull();
});

it.each([
  ['addresses', AddressesScreen],
  ['orders', OrdersScreen],
  ['order detail', OrderDetailScreen],
])('does not execute the %s customer hook while signed out', async (_name, Screen) => {
  const view = await render(<Screen />);

  expect(view.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  expect(customer.useAddresses).not.toHaveBeenCalled();
  expect(customer.useOrders).not.toHaveBeenCalled();
  expect(customer.useOrder).not.toHaveBeenCalled();
});

it.each([
  ['query string', encodeURIComponent('gid://shopify/Order/123?preview=true')],
  ['fragment', encodeURIComponent('gid://shopify/Order/123#shipment')],
  ['extra path suffix', encodeURIComponent('gid://shopify/Order/123/extra')],
  ['control character', encodeURIComponent('gid://shopify/Order/123\nBcc:attacker@example.com')],
  ['terminal whitespace', encodeURIComponent('gid://shopify/Order/123 ')],
  ['malformed URI encoding', '%E0%A4%A'],
])('does not execute the order hook for a direct link with %s', async (_case, routeId) => {
  mockAuthenticated = true;
  mockOrderId = routeId;
  customer.useOrder.mockReturnValue({
    data: null,
    error: null,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });

  const view = await render(<OrderDetailScreen />);

  expect(view.getByText('This order link isn’t valid')).toBeOnTheScreen();
  expect(customer.useOrder).not.toHaveBeenCalled();
});

it('shows signed-in identity, accessible account destinations, and confirms sign-out', async () => {
  mockAuthenticated = true;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const view = await render(<AccountScreen />);

  expect(view.getByText('Morgan Lee')).toBeOnTheScreen();
  expect(view.getByText('morgan@example.com')).toBeOnTheScreen();
  expect(view.getByRole('button', { name: 'Orders' })).toBeOnTheScreen();
  expect(view.getByRole('button', { name: 'Addresses' })).toBeOnTheScreen();

  await fireEvent.press(view.getByRole('button', { name: 'Sign out' }));
  expect(alert).toHaveBeenCalledWith(
    'Sign out?',
    expect.stringMatching(/customer data/i),
    expect.any(Array),
  );
  const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  await act(async () => {
    buttons.find((button) => button.text === 'Sign out')?.onPress?.();
  });
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});

it('exposes an accessible shared order card with separate status badges', async () => {
  const view = await render(
    <OrderCard
      order={{
        id: 'gid://shopify/Order/123',
        name: '#1001',
        processedAt: '2026-08-20T12:00:00Z',
        cancelledAt: null,
        financialStatus: 'PAID',
        fulfillmentStatus: 'PARTIALLY_FULFILLED',
        totalPrice: { amount: '42.00', currencyCode: 'USD' },
        lineItems: { edges: [] },
      }}
    />,
  );

  expect(view.getByRole('button', {
    name: 'Order #1001, $42.00, Aug 20, 2026, Paid, Partially fulfilled',
  })).toBeOnTheScreen();
  expect(view.getByLabelText('Paid')).toBeOnTheScreen();
  expect(view.getByLabelText('Partially fulfilled')).toBeOnTheScreen();
});
