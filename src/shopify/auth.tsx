import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { identify, resetAnalytics, track } from '@/lib/analytics';
import { setMonitoringUser } from '@/lib/monitoring';
import { identifyPushUser, resetPushUser } from '@/notifications/onesignal';
import { clearCustomerQueries } from './customer-session';
import { ShopifyEnv, isCustomerAccountConfigured } from './env';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'storefront.customer.tokens';
const SIGNED_OUT_TOMBSTONE_KEY = 'storefront.customer.signed-out';
const SCOPES = ['openid', 'email', 'customer-account-api:full'];

interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: number; // epoch ms
}

export interface CustomerProfile {
  /** Shopify customer GID — the stable id to key external systems on. */
  id: string | null;
  firstName: string | null;
  lastName: string | null;
  emailAddress: string | null;
}

export type CustomerProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AuthContextValue {
  ready: boolean;
  isAuthenticated: boolean;
  customer: CustomerProfile | null;
  customerProfileStatus: CustomerProfileStatus;
  customerProfileError: string | null;
  /** Stable discriminator used by every protected customer query key. */
  customerSessionKey: string | null;
  retryCustomerProfile: () => Promise<void>;
  /** Returns a valid access token, refreshing first if it's near expiry. */
  getAccessToken: () => Promise<string | null>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${ShopifyEnv.customerAccountApiUrl}/oauth/authorize`,
  tokenEndpoint: `${ShopifyEnv.customerAccountApiUrl}/oauth/token`,
  endSessionEndpoint: `${ShopifyEnv.customerAccountApiUrl}/logout`,
};

const redirectUri = AuthSession.makeRedirectUri({
  scheme: ShopifyEnv.customerAccountScheme || ShopifyEnv.appScheme,
  path: 'callback',
});

async function loadTokens(): Promise<StoredTokens | null> {
  const signedOut = await AsyncStorage.getItem(SIGNED_OUT_TOMBSTONE_KEY);
  if (signedOut) {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await AsyncStorage.removeItem(SIGNED_OUT_TOMBSTONE_KEY);
    } catch {
      // Keep the durable tombstone: persisted credentials remain non-rehydratable.
    }
    return null;
  }
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as StoredTokens) : null;
}
async function saveTokens(t: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(t));
}
async function deleteTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function toStored(r: AuthSession.TokenResponse): StoredTokens {
  return {
    accessToken: r.accessToken,
    refreshToken: r.refreshToken ?? null,
    idToken: r.idToken ?? null,
    expiresAt: Date.now() + (r.expiresIn ?? 3600) * 1000,
  };
}

const PROFILE_QUERY = `query { customer { id firstName lastName emailAddress { emailAddress } } }`;

/**
 * Best-effort call to Shopify's Customer Account API end-session endpoint —
 * mobile clients get a 200 OK rather than a redirect. Never awaited by the
 * caller: local sign-out always completes regardless of the outcome here.
 */
async function endShopifySession(idToken: string): Promise<void> {
  if (!ShopifyEnv.customerAccountApiUrl) return;
  const url = `${ShopifyEnv.customerAccountApiUrl}/logout?id_token_hint=${encodeURIComponent(idToken)}`;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fetch(url),
      new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('logout timed out')), 5000);
      }),
    ]);
  } catch {
    // Best-effort only — local tokens are already cleared either way.
  } finally {
    clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [ready, setReady] = useState(false);
  const tokensRef = useRef<StoredTokens | null>(null);
  const [customerProfileStatus, setCustomerProfileStatus] = useState<CustomerProfileStatus>('idle');
  const [customerProfileError, setCustomerProfileError] = useState<string | null>(null);
  const profileRequestVersion = useRef(0);
  const profileAccessToken = useRef<string | null>(null);

  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  useEffect(() => {
    (async () => {
      try {
        const t = await loadTokens();
        tokensRef.current = t;
        setTokens(t);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const clearCustomerSession = useCallback(async (): Promise<void> => {
    const idToken = tokensRef.current?.idToken ?? null;
    await AsyncStorage.setItem(SIGNED_OUT_TOMBSTONE_KEY, '1');
    tokensRef.current = null;
    let tokenDeletionError: unknown;
    try {
      await deleteTokens();
      await AsyncStorage.removeItem(SIGNED_OUT_TOMBSTONE_KEY);
    } catch (error) {
      tokenDeletionError = error;
    }
    profileRequestVersion.current += 1;
    profileAccessToken.current = null;
    await clearCustomerQueries(queryClient);
    setTokens(null);
    setCustomer(null);
    setCustomerProfileStatus('idle');
    setCustomerProfileError(null);
    resetAnalytics();
    resetPushUser();
    setMonitoringUser(null);
    router.replace('/account');
    // Fire-and-forget: never lets a slow/failed remote logout block or fail
    // local sign-out, which has already completed above.
    if (idToken) void endShopifySession(idToken);
    if (tokenDeletionError) throw tokenDeletionError;
  }, [queryClient]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = tokensRef.current ?? (await loadTokens());
    if (!current) return null;
    if (Date.now() < current.expiresAt - 60_000) return current.accessToken;
    if (!current.refreshToken) {
      if (Date.now() < current.expiresAt) return current.accessToken;
      await clearCustomerSession();
      return null;
    }
    try {
      const r = await AuthSession.refreshAsync(
        {
          clientId: ShopifyEnv.customerAccountClientId,
          refreshToken: current.refreshToken,
        },
        discovery,
      );
      const next = toStored(r);
      next.refreshToken = next.refreshToken ?? current.refreshToken;
      await saveTokens(next);
      tokensRef.current = next;
      setTokens(next);
      return next.accessToken;
    } catch {
      await clearCustomerSession();
      return null;
    }
  }, [clearCustomerSession]);

  const loadCustomerProfile = useCallback(async (token: string): Promise<void> => {
    const requestVersion = ++profileRequestVersion.current;
    await Promise.resolve();
    if (requestVersion !== profileRequestVersion.current) return;
    setCustomer(null);
    setCustomerProfileStatus('loading');
    setCustomerProfileError(null);
    try {
      const res = await fetch(ShopifyEnv.customerAccountGraphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ query: PROFILE_QUERY }),
      });
      const json = await res.json();
      const raw = json?.data?.customer;
      if (!raw) throw new Error('Shopify did not return a customer profile.');
      if (requestVersion !== profileRequestVersion.current) return;
      const nextCustomer: CustomerProfile = {
        id: raw.id ?? null,
        firstName: raw.firstName ?? null,
        lastName: raw.lastName ?? null,
        emailAddress: raw.emailAddress?.emailAddress ?? null,
      };
      setCustomer(nextCustomer);
      setCustomerProfileStatus('ready');
      if (nextCustomer.id) {
        // Identify by the stable Shopify customer GID, never the email — the
        // email is only ever sent along as a person property.
        identify(
          nextCustomer.id,
          nextCustomer.emailAddress ? { email: nextCustomer.emailAddress } : undefined,
        );
        setMonitoringUser(nextCustomer.id);
      }
      if (nextCustomer.id ?? nextCustomer.emailAddress) {
        identifyPushUser(
          (nextCustomer.id ?? nextCustomer.emailAddress)!,
          nextCustomer.emailAddress,
        );
      }
    } catch (error) {
      if (requestVersion === profileRequestVersion.current) {
        setCustomer(null);
        setCustomerProfileStatus('error');
        setCustomerProfileError(
          'We couldn’t load your customer profile. Check your connection and try again.',
        );
      }
      throw error;
    }
  }, []);

  const retryCustomerProfile = useCallback(async (): Promise<void> => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Sign in before loading a customer profile.');
    }
    profileAccessToken.current = token;
    await loadCustomerProfile(token);
  }, [getAccessToken, loadCustomerProfile]);

  useEffect(() => {
    if (!tokens?.accessToken) return;
    let active = true;
    void getAccessToken()
      .then((token) => {
        if (!active || !token || profileAccessToken.current === token) return;
        profileAccessToken.current = token;
        return loadCustomerProfile(token);
      })
      .catch(() => {
        // The explicit profile error remains available to the cart for retry.
      });
    return () => { active = false; };
  }, [getAccessToken, loadCustomerProfile, tokens?.accessToken]);

  const signIn = useCallback(async () => {
    if (!isCustomerAccountConfigured) {
      throw new Error(
        'Customer accounts are not configured. Set EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_* in .env.local.',
      );
    }
    const request = new AuthSession.AuthRequest({
      clientId: ShopifyEnv.customerAccountClientId,
      redirectUri,
      scopes: SCOPES,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    });
    const result = await request.promptAsync(discovery);
    if (result.type !== 'success' || !result.params.code) return;

    const exchange = await AuthSession.exchangeCodeAsync(
      {
        clientId: ShopifyEnv.customerAccountClientId,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      discovery,
    );
    const stored = toStored(exchange);
    await saveTokens(stored);
    await AsyncStorage.removeItem(SIGNED_OUT_TOMBSTONE_KEY);
    tokensRef.current = stored;
    setTokens(stored);
    track('login');
  }, []);

  const signOut = useCallback(async () => {
    await clearCustomerSession();
  }, [clearCustomerSession]);

  const customerSessionKey = customer?.id ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      isAuthenticated: Boolean(tokens?.accessToken),
      customer,
      customerProfileStatus,
      customerProfileError,
      customerSessionKey,
      retryCustomerProfile,
      getAccessToken,
      signIn,
      signOut,
    }),
    [
      ready,
      tokens?.accessToken,
      customer,
      customerProfileStatus,
      customerProfileError,
      customerSessionKey,
      retryCustomerProfile,
      getAccessToken,
      signIn,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

/** The redirect URI to register as a Callback URL in the Shopify admin. */
export const CUSTOMER_ACCOUNT_REDIRECT_URI = redirectUri;
