import {
  ApplePayContactField,
  useShopifyCheckoutSheet,
  type AcceleratedCheckoutConfiguration,
} from '@shopify/checkout-sheet-kit';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth';
import { ShopifyEnv } from './env';

/**
 * In its own module, separate from `checkout.tsx`: that file's
 * `handleCheckoutCompletion`/`navigateToConfirmation` are imported by
 * `WalletCheckoutButtons` (a component reachable from many screens via the
 * `@/components/commerce` barrel), and pulling in `useAuth` — and therefore
 * `expo-secure-store`/`AsyncStorage` — there would force every consumer of
 * that barrel to mock auth, even screens with nothing to do with checkout.
 */
export function acceleratedCheckoutConfiguration(accessToken: string | null): AcceleratedCheckoutConfiguration {
  return {
    storefrontDomain: ShopifyEnv.storeDomain,
    storefrontAccessToken: ShopifyEnv.storefrontToken,
    customer: accessToken ? { accessToken } : undefined,
    wallets: ShopifyEnv.applePayMerchantId
      ? {
          applePay: {
            contactFields: [ApplePayContactField.email],
            merchantIdentifier: ShopifyEnv.applePayMerchantId,
          },
        }
      : undefined,
  };
}

/**
 * Keeps accelerated checkout's buyer identity in sync with sign-in state.
 * `ShopifyCheckoutSheetProvider`'s `configuration` prop is set once in
 * `_layout.tsx`, above `AuthProvider`, so it can't itself react to auth
 * changes — this re-applies the configuration (via the checkout context's
 * `setConfig`, which the native SDK re-validates) whenever the signed-in
 * customer's token would change. Mount once, next to `CheckoutEvents`.
 * No-op when accelerated checkout isn't enabled or on Android.
 */
export function AcceleratedCheckoutConfigurator() {
  const checkout = useShopifyCheckoutSheet();
  const { isAuthenticated, getAccessToken } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'ios' || !ShopifyEnv.acceleratedCheckoutEnabled) return;
    let cancelled = false;
    (async () => {
      const accessToken = isAuthenticated ? await getAccessToken() : null;
      if (cancelled) return;
      try {
        const current = await checkout.getConfig();
        await checkout.setConfig({
          ...current,
          acceleratedCheckouts: acceleratedCheckoutConfiguration(accessToken),
        });
      } catch {
        // Accelerated checkout falls back to unavailable; the sheet checkout still works.
      }
    })();
    return () => { cancelled = true; };
  }, [checkout, getAccessToken, isAuthenticated]);

  return null;
}
