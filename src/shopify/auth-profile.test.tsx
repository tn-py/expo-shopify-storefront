import * as SecureStore from 'expo-secure-store';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { AuthProvider, useAuth, type AuthContextValue } from './auth';

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
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;
let latestAuth: AuthContextValue | null = null;

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
  mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
    accessToken: 'token',
    refreshToken: null,
    idToken: null,
    expiresAt: Date.now() + 60_000,
  }));
});

it('surfaces profile load failure and recovers through an explicit retry', async () => {
  mockFetch.mockRejectedValueOnce(new Error('offline'));
  await render(<AuthProvider><Probe /></AuthProvider>);

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
