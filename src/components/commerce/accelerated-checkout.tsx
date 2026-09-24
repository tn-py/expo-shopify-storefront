import {
  AcceleratedCheckoutButtons,
  AcceleratedCheckoutWallet,
  RenderState,
  type AcceleratedCheckoutButtonsProps,
  type CheckoutCompletedEvent,
  type CheckoutException,
  type RenderStateChangeEvent,
} from '@shopify/checkout-sheet-kit';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { track } from '@/lib/analytics';
import { useCart } from '@/shopify/cart';
import { handleCheckoutCompletion, navigateToConfirmation } from '@/shopify/checkout';
import { ShopifyEnv } from '@/shopify/env';

export type WalletCheckoutButtonsProps =
  | { cartId: string }
  | { variantId: string; quantity: number };

/**
 * Shop Pay / Apple Pay wallet buttons for a fast, one-tap checkout —
 * completion is handled the same way as the regular Checkout Sheet
 * (`CheckoutEvents`): track the purchase, clear the local cart, and navigate
 * to the order-confirmed screen.
 *
 * Opt-in via `EXPO_PUBLIC_SHOPIFY_ACCELERATED_CHECKOUT=true` (the merchant
 * must request the `write_cart_wallet_payments` Storefront API scope first —
 * see `docs/accelerated-checkout.md`) and iOS 16+ only. Renders nothing on
 * Android, when disabled, or when the native buttons report they can't
 * render for this cart/variant (`RenderState.Error`, e.g. no wallet set up).
 */
export function WalletCheckoutButtons(props: WalletCheckoutButtonsProps) {
  const { clearLocal } = useCart();
  const router = useRouter();
  const [renderable, setRenderable] = useState(true);
  const enabled = Platform.OS === 'ios' && ShopifyEnv.acceleratedCheckoutEnabled;

  const onComplete = useCallback((event: CheckoutCompletedEvent) => {
    handleCheckoutCompletion(event, {
      clearLocal,
      navigateToConfirmation: (params) => navigateToConfirmation(router, params),
    });
  }, [clearLocal, router]);

  const onFail = useCallback((error: CheckoutException) => {
    track('checkout_error', { reason: 'accelerated_checkout' });
    if (__DEV__) console.warn('[accelerated checkout]', error);
  }, []);

  const onRenderStateChange = useCallback((event: RenderStateChangeEvent) => {
    if (event.state === RenderState.Error) setRenderable(false);
  }, []);

  if (!enabled || !renderable) return null;

  const wallets = ShopifyEnv.applePayMerchantId
    ? [AcceleratedCheckoutWallet.shopPay, AcceleratedCheckoutWallet.applePay]
    : [AcceleratedCheckoutWallet.shopPay];

  return (
    <AcceleratedCheckoutButtons
      {...(props as AcceleratedCheckoutButtonsProps)}
      wallets={wallets}
      onComplete={onComplete}
      onFail={onFail}
      onRenderStateChange={onRenderStateChange}
    />
  );
}
