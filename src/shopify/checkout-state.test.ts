import { checkoutErrorMessage, createCheckoutPresentationGuard } from './checkout-state';

describe('checkout presentation guard', () => {
  it('prevents a second presentation until the current sheet closes', () => {
    const present = jest.fn();
    const guard = createCheckoutPresentationGuard(present);

    expect(guard.present('https://shop.example/checkouts/1')).toBe(true);
    expect(guard.present('https://shop.example/checkouts/1')).toBe(false);
    expect(present).toHaveBeenCalledTimes(1);

    guard.release();
    expect(guard.present('https://shop.example/checkouts/1')).toBe(true);
    expect(present).toHaveBeenCalledTimes(2);
  });

  it('does not expose technical Checkout Sheet errors to shoppers', () => {
    expect(checkoutErrorMessage(new Error('HTTP 500 at /checkouts/token'))).toBe(
      'We couldn’t open Shopify Checkout. Your cart is still here—please try again.',
    );
  });
});
