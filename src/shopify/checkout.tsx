import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import {
  CheckoutExpiredError,
  useShopifyCheckoutSheet,
  type CheckoutCompletedEvent,
  type CheckoutException,
} from '@shopify/checkout-sheet-kit';

import { track } from '@/lib/analytics';
import { useCart } from './cart';

/**
 * App-level checkout lifecycle listener. Mount once inside the providers so the
 * `completed` / `error` handlers run no matter which screen is active.
 */
export function CheckoutEvents() {
  const checkout = useShopifyCheckoutSheet();
  const { clearLocal, refresh } = useCart();
  const router = useRouter();

  useEffect(() => {
    const completed = checkout.addEventListener(
      'completed',
      (event: CheckoutCompletedEvent) => {
        track('purchase', {
          order_id: event?.orderDetails?.id,
          total: event?.orderDetails?.cart?.price?.total?.amount,
        });
        void clearLocal();
        router.replace('/order-confirmed');
      },
    );

    const errored = checkout.addEventListener('error', (error: CheckoutException) => {
      // Expired carts are recoverable — rebuild by refetching.
      if (error instanceof CheckoutExpiredError) {
        void refresh();
      }
      Alert.alert(
        'Checkout problem',
        error?.message ?? 'Something went wrong opening checkout. Please try again.',
      );
    });

    return () => {
      completed?.remove();
      errored?.remove();
    };
  }, [checkout, clearLocal, refresh, router]);

  return null;
}

/**
 * Returns a `startCheckout` action plus keeps the current cart's checkout URL
 * preloaded so the sheet opens instantly.
 */
export function useCheckout() {
  const checkout = useShopifyCheckoutSheet();
  const { cart } = useCart();
  const checkoutUrl = cart?.checkoutUrl;

  useEffect(() => {
    if (checkoutUrl) checkout.preload(checkoutUrl);
  }, [checkout, checkoutUrl]);

  return {
    canCheckout: Boolean(checkoutUrl) && (cart?.totalQuantity ?? 0) > 0,
    startCheckout: () => {
      if (!checkoutUrl) return;
      track('checkout_started', { total: cart?.cost.totalAmount.amount });
      checkout.present(checkoutUrl);
    },
  };
}
