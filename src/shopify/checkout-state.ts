export interface CheckoutPresentationGuard {
  present: (checkoutUrl: string, presentCheckout?: (checkoutUrl: string) => void) => boolean;
  release: () => void;
  isPresenting: () => boolean;
}

/** Locks synchronously so two taps in the same render can only present one sheet. */
export function createCheckoutPresentationGuard(
  defaultPresenter?: (checkoutUrl: string) => void,
): CheckoutPresentationGuard {
  let presenting = false;
  return {
    present(checkoutUrl, presenter) {
      if (presenting) return false;
      const presentCheckout = presenter ?? defaultPresenter;
      if (!presentCheckout) throw new Error('A checkout presenter is required.');
      presenting = true;
      try {
        presentCheckout(checkoutUrl);
        return true;
      } catch (error) {
        presenting = false;
        throw error;
      }
    },
    release() {
      presenting = false;
    },
    isPresenting() {
      return presenting;
    },
  };
}

export function checkoutErrorMessage(_error: unknown): string {
  return 'We couldn’t open Shopify Checkout. Your cart is still here—please try again.';
}
