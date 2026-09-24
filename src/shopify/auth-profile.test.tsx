import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
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
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
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
jest.mock('@/lib/monitoring', () => ({ setMonitoringUser: jest.fn() }));
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
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockAuthSession = AuthSession as jest.Mocked<typeof AuthSession>;
const mockRouter = jest.requireMock('expo-router').router as { replace: jest.Mock };
const mockIdentify = jest.requireMock('@/lib/analytics').identify as jest.Mock;
const mockSetMonitoringUser = jest.requireMock('@/lib/monitoring').setMonitoringUser as jest.Mock;
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;
let latestAuth: AuthContextValue | null = null;
let queryClient: QueryClient;
let durableStorage: Map<string, string>;

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
  durableStorage = new Map();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockAsyncStorage.getItem.mockImplementation(async (key) => durableStorage.get(key) ?? null);
  mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
    durableStorage.set(key, value);
  });
  mockAsyncStorage.removeItem.mockImplementation(async (key) => {
    durableStorage.delete(key);
  });
  mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
    accessToken: 'token',
    refreshToken: null,
    idToken: null,
    expiresAt: Date.now() + 3_600_000,
  }));
});

afterEach(() => {
  queryClient.clear();
  jest.restoreAllMocks();
});

function renderAuth() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><Probe /></AuthProvider>
    </QueryClientProvider>,
  );
}

it('refreshes an expired stored access token before cold-start profile loading', async () => {
  mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
    accessToken: 'expired-token',
    refreshToken: 'refresh-token',
    idToken: null,
    expiresAt: Date.now() - 1,
  }));
  mockAuthSession.refreshAsync.mockResolvedValue({
    accessToken: 'fresh-token',
    refreshToken: 'next-refresh-token',
    expiresIn: 3600,
  } as AuthSession.TokenResponse);
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
  expect(mockAuthSession.refreshAsync).toHaveBeenCalledWith(
    expect.objectContaining({ refreshToken: 'refresh-token' }),
    expect.any(Object),
  );
  expect(mockFetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'fresh-token' }) }),
  );
});

it('clears an expired non-refreshable session without requesting a profile', async () => {
  mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
    accessToken: 'expired-token',
    refreshToken: null,
    idToken: null,
    expiresAt: Date.now() - 1,
  }));

  await renderAuth();

  await waitFor(() => expect(latestAuth?.ready).toBe(true));
  await waitFor(() => expect(latestAuth?.isAuthenticated).toBe(false));
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
});

it('refreshes an expired access token before retrying the customer profile', async () => {
  const initialNow = Date.now();
  const now = jest.spyOn(Date, 'now').mockReturnValue(initialNow);
  mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
    accessToken: 'first-token',
    refreshToken: 'refresh-token',
    idToken: null,
    expiresAt: initialNow + 120_000,
  }));
  mockFetch.mockRejectedValueOnce(new Error('offline'));
  await renderAuth();
  await waitFor(() => expect(latestAuth?.customerProfileStatus).toBe('error'));

  now.mockReturnValue(initialNow + 180_000);
  mockAuthSession.refreshAsync.mockResolvedValue({
    accessToken: 'retry-token',
    refreshToken: 'refresh-token',
    expiresIn: 3600,
  } as AuthSession.TokenResponse);
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

  expect(mockFetch).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'retry-token' }) }),
  );
  now.mockRestore();
});

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

it('identifies analytics by the stable Shopify customer GID, sending email only as a property', async () => {
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

  expect(mockIdentify).toHaveBeenCalledWith('gid://shopify/Customer/1', { email: 'member@example.com' });
  expect(mockIdentify).not.toHaveBeenCalledWith('member@example.com', expect.anything());
  expect(mockSetMonitoringUser).toHaveBeenCalledWith('gid://shopify/Customer/1');
});

it('clears the monitoring user on sign-out', async () => {
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

  await act(async () => {
    await latestAuth!.signOut();
  });

  expect(mockSetMonitoringUser).toHaveBeenLastCalledWith(null);
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
  // No id token was stored, so no best-effort remote logout call is made —
  // only the earlier profile-load fetch happened.
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('makes a best-effort call to Shopify’s end-session endpoint on sign-out when an id token is stored', async () => {
  mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
    accessToken: 'token',
    refreshToken: null,
    idToken: 'id-token-abc',
    expiresAt: Date.now() + 3_600_000,
  }));
  mockFetch.mockResolvedValue({ json: async () => ({}) });
  await renderAuth();
  await waitFor(() => expect(latestAuth?.ready).toBe(true));

  await act(async () => {
    await latestAuth!.signOut();
  });

  await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
    'https://account.example.com/logout?id_token_hint=id-token-abc',
  ));
});

it('never lets a hanging or failed remote logout call block or fail local sign-out', async () => {
  mockSecureStore.getItemAsync.mockResolvedValue(JSON.stringify({
    accessToken: 'token',
    refreshToken: null,
    idToken: 'id-token-abc',
    expiresAt: Date.now() + 3_600_000,
  }));
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/logout')) return new Promise(() => undefined); // never resolves
    return Promise.resolve({ json: async () => ({}) });
  });
  await renderAuth();
  await waitFor(() => expect(latestAuth?.ready).toBe(true));

  await act(async () => {
    await latestAuth!.signOut();
  });

  expect(latestAuth?.isAuthenticated).toBe(false);
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

it('keeps credentials non-rehydratable across restart when secure deletion fails', async () => {
  mockFetch.mockResolvedValue({
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
  const firstMount = await renderAuth();
  await waitFor(() => expect(latestAuth?.customerProfileStatus).toBe('ready'));
  mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('storage unavailable'));

  await act(async () => {
    await expect(latestAuth!.signOut()).rejects.toThrow('storage unavailable');
  });
  await firstMount.unmount();
  latestAuth = null;
  const profileRequestsBeforeRestart = mockFetch.mock.calls.length;

  await renderAuth();

  await waitFor(() => expect(latestAuth?.ready).toBe(true));
  expect((latestAuth as AuthContextValue | null)?.isAuthenticated).toBe(false);
  expect(mockFetch).toHaveBeenCalledTimes(profileRequestsBeforeRestart);
});
