import {
  CheckoutExpiredError,
  useShopifyCheckoutSheet,
  type CheckoutCompletedEvent,
  type CheckoutException,
} from '@shopify/checkout-sheet-kit';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { track } from '@/lib/analytics';
import { formatMoney } from '@/lib/format';
import { useCart } from './cart';
import {
  checkoutErrorMessage,
  createCheckoutPresentationGuard,
  type CheckoutPresentationGuard,
} from './checkout-state';

export interface ConfirmationParams {
  orderId?: string;
  orderName?: string;
  displayTotal?: string;
  customerEmail?: string;
}

export interface CheckoutStatus {
  presenting: boolean;
  error: string | null;
  recovered: boolean;
}

function completionParams(event: CheckoutCompletedEvent): ConfirmationParams {
  const details = event.orderDetails;
  const total = details.cart.price.total;
  return {
    orderId: details.id || undefined,
    displayTotal:
      total?.amount != null && total.currencyCode
        ? formatMoney({ amount: String(total.amount), currencyCode: total.currencyCode })
        : undefined,
    customerEmail: details.email || undefined,
  };
}

/** Mount once so completion clears the cart and navigates even as routes change. */
export function CheckoutEvents() {
  const checkout = useShopifyCheckoutSheet();
  const { clearLocal } = useCart();
  const router = useRouter();

  useEffect(() => {
    const completed = checkout.addEventListener(
      'completed',
      (event: CheckoutCompletedEvent) => {
        const params = completionParams(event);
        track('purchase', {
          order_id: params.orderId,
          total: params.displayTotal,
        });
        void clearLocal();
        router.replace({
          pathname: '/order-confirmed',
          params: Object.fromEntries(
            Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
          ),
        });
      },
    );

    return () => completed?.remove();
  }, [checkout, clearLocal, router]);

  return null;
}

/** Preloads and safely presents Shopify Checkout Sheet as the final authority. */
export function useCheckout() {
  const checkout = useShopifyCheckoutSheet();
  const {
    cart,
    operations,
    recoverStaleCart,
    syncBuyerIdentity,
  } = useCart();
  const checkoutUrl = cart?.checkoutUrl;
  const [status, setStatus] = useState<CheckoutStatus>({
    presenting: false,
    error: null,
    recovered: false,
  });
  const [guard] = useState<CheckoutPresentationGuard>(() => createCheckoutPresentationGuard());

  useEffect(() => {
    if (checkoutUrl) checkout.preload(checkoutUrl);
  }, [checkout, checkoutUrl]);

  const prepareAndPresent = useCallback(async (url: string) => {
    try {
      await syncBuyerIdentity();
      checkout.present(url);
    } catch {
      guard.release();
      setStatus({
        presenting: false,
        error: 'We couldn’t prepare checkout. Your cart is still here—please try again.',
        recovered: false,
      });
      track('checkout_present_failed');
    }
  }, [checkout, guard, syncBuyerIdentity]);

  useEffect(() => {
    const closed = checkout.addEventListener('close', () => {
      guard.release();
      setStatus((current) => ({ ...current, presenting: false }));
    });
    const errored = checkout.addEventListener('error', (error: CheckoutException) => {
      guard.release();
      if (error instanceof CheckoutExpiredError) {
        setStatus({
          presenting: false,
          error: 'That checkout expired. We’re refreshing your cart so you can try again.',
          recovered: false,
        });
        track('checkout_error', { reason: 'expired' });
        void recoverStaleCart()
          .then((recovered) => {
            setStatus({
              presenting: false,
              error: recovered
                ? 'Your cart was refreshed. Review it, then try checkout again.'
                : 'That checkout is no longer available. Please add your items again.',
              recovered,
            });
            if (recovered) track('checkout_recovered');
          })
          .catch(() => {
            setStatus({
              presenting: false,
              error: 'We couldn’t refresh your cart. Check your connection and try again.',
              recovered: false,
            });
          });
        return;
      }
      setStatus({
        presenting: false,
        error: checkoutErrorMessage(error),
        recovered: false,
      });
      track('checkout_error', { reason: 'sheet_error' });
    });

    return () => {
      closed?.remove();
      errored?.remove();
    };
  }, [checkout, guard, recoverStaleCart]);

  const startCheckout = useCallback((): boolean => {
    if (!checkoutUrl) return false;
    const started = guard.present(checkoutUrl, (url) => { void prepareAndPresent(url); });
    if (!started) return false;
    setStatus({ presenting: true, error: null, recovered: false });
    track('checkout_started', {
      total: cart?.cost.totalAmount.amount,
      currency: cart?.cost.totalAmount.currencyCode,
    });
    return true;
  }, [cart?.cost.totalAmount.amount, cart?.cost.totalAmount.currencyCode, checkoutUrl, guard, prepareAndPresent]);

  const cartMutationPending = Object.values(operations).some((operation) => operation.pending);
  return {
    canCheckout:
      Boolean(checkoutUrl) &&
      (cart?.totalQuantity ?? 0) > 0 &&
      !cartMutationPending &&
      !status.presenting,
    startCheckout,
    ...status,
  };
}
