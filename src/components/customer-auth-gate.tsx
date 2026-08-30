import { useState, type ReactNode } from 'react';

import { StateView } from '@/components/ui';
import { useAuth, type CustomerProfile } from '@/shopify/auth';
import { isCustomerAccountConfigured } from '@/shopify/env';

export interface AuthenticatedCustomerAccess {
  customer: CustomerProfile;
  customerSessionKey: string;
  getAccessToken: () => Promise<string | null>;
}

export function CustomerAuthGate({
  children,
}: {
  children: (access: AuthenticatedCustomerAccess) => ReactNode;
}) {
  const auth = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!auth.ready) return <StateView mode="loading" title="Loading account…" />;
  if (!isCustomerAccountConfigured) {
    return (
      <StateView
        mode="empty"
        title="Sign in isn’t configured"
        message="Add the Shopify Customer Account settings to enable this screen."
      />
    );
  }
  if (!auth.isAuthenticated) {
    return (
      <StateView
        mode={actionError ? 'error' : 'empty'}
        title="Sign in to continue"
        message={actionError ?? 'Your account details stay private until you sign in.'}
        actionLabel={signingIn ? 'Opening sign in…' : 'Sign in'}
        onAction={async () => {
          setSigningIn(true);
          setActionError(null);
          try {
            await auth.signIn();
          } catch (error) {
            setActionError((error as Error).message);
          } finally {
            setSigningIn(false);
          }
        }}
      />
    );
  }
  if (auth.customerProfileStatus === 'loading' || auth.customerProfileStatus === 'idle') {
    return <StateView mode="loading" title="Loading your account…" />;
  }
  if (auth.customerProfileStatus === 'error') {
    return (
      <StateView
        mode="error"
        title="We couldn’t load your account"
        message={auth.customerProfileError ?? undefined}
        actionLabel="Retry customer profile"
        onAction={() => void auth.retryCustomerProfile().catch(() => undefined)}
      />
    );
  }
  if (!auth.customer || !auth.customerSessionKey) {
    return (
      <StateView
        mode="error"
        title="We couldn’t verify this account"
        message="Sign out and sign in again before viewing customer details."
      />
    );
  }

  return children({
    customer: auth.customer,
    customerSessionKey: auth.customerSessionKey,
    getAccessToken: auth.getAccessToken,
  });
}
