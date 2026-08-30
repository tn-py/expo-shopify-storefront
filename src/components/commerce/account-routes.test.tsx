import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import AccountScreen from '@/app/(tabs)/account';
import AddressesScreen from '@/app/account/addresses';
import OrderDetailScreen from '@/app/account/order/[id]';
import OrdersScreen from '@/app/account/orders';
import { OrderCard } from '@/components/ui';

let mockOrderId = encodeURIComponent('gid://shopify/Order/123');
const mockSignOut = jest.fn();
let mockAuthenticated = false;

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
    customerSessionKey: null,
    getAccessToken: jest.fn(),
    signIn: jest.fn(),
    signOut: mockSignOut,
    retryCustomerProfile: jest.fn(),
  }),
}));
jest.mock('@/shopify/env', () => ({
  isCustomerAccountConfigured: true,
  ShopifyEnv: { customerAccountManagementUrl: 'https://accounts.example.com/addresses' },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockOrderId = encodeURIComponent('gid://shopify/Order/123');
  mockAuthenticated = false;
  mockSignOut.mockResolvedValue(undefined);
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

  expect(view.getByRole('button', { name: 'View order #1001' })).toBeOnTheScreen();
  expect(view.getByLabelText('Paid')).toBeOnTheScreen();
  expect(view.getByLabelText('Partially fulfilled')).toBeOnTheScreen();
});
