import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { AuthProvider, useAuth, type AuthContextValue } from './auth';
import { customerQueryKey } from './customer-session';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'shopstore://callback'),
  ResponseType: { Code: 'code' },
  AuthRequest: jest.fn(),
  refreshAsync: jest.fn(),
  exchangeCodeAsync: jest.fn(),
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({
  identify: jest.fn(),
  resetAnalytics: jest.fn(),
  track: jest.fn(),
}));
jest.mock('@/notifications/onesignal', () => ({
  identifyPushUser: jest.fn(),
  resetPushUser: jest.fn(),
}));
jest.mock('./env', () => ({
  ShopifyEnv: {
    customerAccountApiUrl: 'https://account.example.com',
    customerAccountGraphqlUrl: 'https://account.example.com/graphql',
    customerAccountClientId: 'client',
    customerAccountScheme: 'shopstore',
    appScheme: 'shopstore',
  },
  isCustomerAccountConfigured: true,
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockRouter = jest.requireMock('expo-router').router as { replace: jest.Mock };
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;
let latestAuth: AuthContextValue | null = null;
let queryClient: QueryClient;

function Probe() {
  const auth = useAuth();
  useEffect(() => {
    latestAuth = auth;
  }, [auth]);
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  latestAuth = null;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
    accessToken: 'token',
    refreshToken: null,
    idToken: null,
    expiresAt: Date.now() + 60_000,
  }));
});

afterEach(() => {
  queryClient.clear();
});

function renderAuth() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><Probe /></AuthProvider>
    </QueryClientProvider>,
  );
}

it('surfaces profile load failure and recovers through an explicit retry', async () => {
  mockFetch.mockRejectedValueOnce(new Error('offline'));
  await renderAuth();

  await waitFor(() => expect(latestAuth?.customerProfileStatus).toBe('error'));
  expect(latestAuth?.customerProfileError).toMatch(/couldn’t load/i);

  mockFetch.mockResolvedValueOnce({
    json: async () => ({
      data: {
        customer: {
          id: 'gid://shopify/Customer/1',
          firstName: 'Morgan',
          lastName: null,
          emailAddress: { emailAddress: 'member@example.com' },
        },
      },
    }),
  });
  await act(async () => {
    await latestAuth!.retryCustomerProfile();
  });

  await waitFor(() => expect(latestAuth?.customerProfileStatus).toBe('ready'));
  expect(latestAuth?.customer?.emailAddress).toBe('member@example.com');
});

it('removes protected customer data and navigation when signing out', async () => {
  mockFetch.mockResolvedValueOnce({
    json: async () => ({
      data: {
        customer: {
          id: 'gid://shopify/Customer/1',
          firstName: 'Morgan',
          lastName: null,
          emailAddress: { emailAddress: 'member@example.com' },
        },
      },
    }),
  });
  await renderAuth();
  await waitFor(() => expect(latestAuth?.customerProfileStatus).toBe('ready'));

  expect(latestAuth?.customerSessionKey).toBe('gid://shopify/Customer/1');
  queryClient.setQueryData(
    customerQueryKey(latestAuth!.customerSessionKey!, 'orders'),
    ['private-order'],
  );

  await act(async () => {
    await latestAuth!.signOut();
  });

  expect(queryClient.getQueriesData({ queryKey: ['customer'] })).toEqual([]);
  expect(mockRouter.replace).toHaveBeenCalledWith('/account');
});

it('still removes protected data when secure token deletion fails', async () => {
  mockFetch.mockResolvedValueOnce({
    json: async () => ({
      data: {
        customer: {
          id: 'gid://shopify/Customer/1',
          firstName: 'Morgan',
          lastName: null,
          emailAddress: { emailAddress: 'member@example.com' },
        },
      },
    }),
  });
  await renderAuth();
  await waitFor(() => expect(latestAuth?.customerProfileStatus).toBe('ready'));
  queryClient.setQueryData(
    customerQueryKey(latestAuth!.customerSessionKey!, 'orders'),
    ['private-order'],
  );
  mockSecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('storage unavailable'));

  await act(async () => {
    await expect(latestAuth!.signOut()).rejects.toThrow('storage unavailable');
  });

  expect(queryClient.getQueriesData({ queryKey: ['customer'] })).toEqual([]);
  expect(latestAuth?.isAuthenticated).toBe(false);
  expect(mockRouter.replace).toHaveBeenCalledWith('/account');
});
