import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
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
import { identifyPushUser, resetPushUser } from '@/notifications/onesignal';
import { ShopifyEnv, isCustomerAccountConfigured } from './env';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'storefront.customer.tokens';
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

interface AuthContextValue {
  ready: boolean;
  isAuthenticated: boolean;
  customer: CustomerProfile | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [ready, setReady] = useState(false);
  const tokensRef = useRef<StoredTokens | null>(null);

  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  useEffect(() => {
    (async () => {
      try {
        const t = await loadTokens();
        setTokens(t);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = tokensRef.current ?? (await loadTokens());
    if (!current) return null;
    if (Date.now() < current.expiresAt - 60_000) return current.accessToken;
    if (!current.refreshToken) return current.accessToken; // best effort
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
      setTokens(next);
      return next.accessToken;
    } catch {
      await deleteTokens();
      setTokens(null);
      setCustomer(null);
      return null;
    }
  }, []);

  // Load the profile whenever we hold a token. (Clearing on sign-out / refresh
  // failure is handled where the tokens are cleared.)
  useEffect(() => {
    const token = tokens?.accessToken;
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(ShopifyEnv.customerAccountGraphqlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({ query: PROFILE_QUERY }),
        });
        const json = await res.json();
        const raw = json?.data?.customer;
        if (raw && !cancelled) {
          const c: CustomerProfile = {
            id: raw.id ?? null,
            firstName: raw.firstName ?? null,
            lastName: raw.lastName ?? null,
            emailAddress: raw.emailAddress?.emailAddress ?? null,
          };
          setCustomer(c);
          if (c.emailAddress) identify(c.emailAddress, { email: c.emailAddress });
          if (c.id ?? c.emailAddress) {
            identifyPushUser((c.id ?? c.emailAddress)!, c.emailAddress);
          }
        }
      } catch {
        // non-fatal — profile just stays null
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokens?.accessToken]);

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
    setTokens(stored);
    track('login');
  }, []);

  const signOut = useCallback(async () => {
    await deleteTokens();
    setTokens(null);
    setCustomer(null);
    resetAnalytics();
    resetPushUser();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      isAuthenticated: Boolean(tokens?.accessToken),
      customer,
      getAccessToken,
      signIn,
      signOut,
    }),
    [ready, tokens?.accessToken, customer, getAccessToken, signIn, signOut],
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
