import type { Cart, CartLine } from './types';
import {
  buyerIdentityKey,
  buyerIdentityKeyMatchesTarget,
  buyerIdentityUpdateInput,
  cartCreateBuyerIdentity,
  cartDiscountTotal,
  cartOperationReducer,
  createCartOperationState,
  fingerprintToken,
  QuantityUpdateQueue,
  removalUndoInput,
  recoverStaleCart,
  resolveBuyerIdentityTarget,
} from './cart-operations';

const money = { amount: '20.00', currencyCode: 'USD' };
const line: CartLine = {
  id: 'line-1',
  quantity: 2,
  cost: { totalAmount: { amount: '40.00', currencyCode: 'USD' }, amountPerQuantity: money },
  discountAllocations: [],
  merchandise: {
    id: 'variant-1',
    title: 'Blue',
    image: null,
    product: { handle: 'shirt', title: 'Everyday shirt' },
    selectedOptions: [{ name: 'Color', value: 'Blue' }],
    price: money,
  },
};
const cart: Cart = {
  id: 'cart-1',
  checkoutUrl: 'https://shop.example/checkouts/1',
  totalQuantity: 2,
  discountCodes: [],
  discountAllocations: [],
  cost: { subtotalAmount: { amount: '40.00', currencyCode: 'USD' }, totalAmount: { amount: '40.00', currencyCode: 'USD' } },
  lines: { nodes: [line] },
};

describe('cart operation recovery', () => {
  it('keeps the last coherent cart and records a retryable line error when a mutation fails', () => {
    const pending = cartOperationReducer(createCartOperationState(cart), {
      type: 'started',
      key: 'line:line-1',
      kind: 'update',
    });
    const failed = cartOperationReducer(pending, {
      type: 'failed',
      key: 'line:line-1',
      message: 'We couldn’t update this quantity. Try again.',
    });

    expect(failed.cart).toBe(cart);
    expect(failed.operations['line:line-1']).toEqual({
      kind: 'update',
      pending: false,
      error: 'We couldn’t update this quantity. Try again.',
    });
  });

  it('serializes rapid quantity changes and coalesces queued changes to the latest value', async () => {
    let releaseFirst!: () => void;
    const firstRequest = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const sent: number[] = [];
    const queue = new QuantityUpdateQueue(async (_lineId, quantity) => {
      sent.push(quantity);
      if (sent.length === 1) await firstRequest;
    });

    const first = queue.request('line-1', 2);
    const second = queue.request('line-1', 3);
    const third = queue.request('line-1', 4);
    expect(sent).toEqual([2]);

    releaseFirst();
    await Promise.all([first, second, third]);
    expect(sent).toEqual([2, 4]);
  });

  it('recreates a removed line with its variant and original quantity for undo', () => {
    expect(removalUndoInput(line)).toEqual({ merchandiseId: 'variant-1', quantity: 2 });
  });

  it('discards operation errors and undo history when the local cart is cleared', () => {
    const withUndo = cartOperationReducer(createCartOperationState(cart), {
      type: 'completed',
      key: 'line:line-1',
      cart: { ...cart, totalQuantity: 0, lines: { nodes: [] } },
      removedLine: line,
    });

    const cleared = cartOperationReducer(withUndo, { type: 'reset' });

    expect(cleared).toEqual(createCartOperationState());
  });

  it('rebuilds an expired cart from the prior line snapshot', async () => {
    const recreate = jest.fn().mockResolvedValue({ ...cart, id: 'cart-2', checkoutUrl: 'https://shop.example/checkouts/2' });

    const recovered = await recoverStaleCart(cart, jest.fn().mockResolvedValue(null), recreate);

    expect(recreate).toHaveBeenCalledWith([{ merchandiseId: 'variant-1', quantity: 2 }]);
    expect(recovered?.id).toBe('cart-2');
  });

  it('records the latest non-blocking cart warnings and clears them on dismissal', () => {
    const warned = cartOperationReducer(createCartOperationState(cart), {
      type: 'warningsReceived',
      warnings: [{ code: 'LINE_QUANTITY_ADJUSTED', message: 'We adjusted a quantity for stock.', target: 'line-1' }],
    });
    expect(warned.warnings).toHaveLength(1);

    const ignored = cartOperationReducer(warned, { type: 'warningsReceived', warnings: [] });
    expect(ignored.warnings).toBe(warned.warnings);

    const dismissed = cartOperationReducer(warned, { type: 'warningsDismissed' });
    expect(dismissed.warnings).toEqual([]);
  });
});

describe('buyer identity resolution', () => {
  it('stays pending until auth is ready, then pending again while a signed-in profile loads', () => {
    expect(resolveBuyerIdentityTarget(false, false, null)).toEqual({ status: 'pending' });
    expect(resolveBuyerIdentityTarget(true, true, null, 'loading', null)).toEqual({ status: 'pending' });
  });

  it('surfaces a retryable profile error without ever leaking a stale email into the identity target', () => {
    expect(resolveBuyerIdentityTarget(true, true, null, 'error', 'offline')).toEqual({
      status: 'error',
      message: 'offline',
    });
  });

  it('resolves a guest target with only the market country code, never an email', () => {
    expect(resolveBuyerIdentityTarget(true, false, null, 'idle', null, 'US')).toEqual({
      status: 'ready',
      kind: 'guest',
      countryCode: 'US',
    });
  });

  it('resolves a signed-in customer target with their email and the market country code', () => {
    expect(
      resolveBuyerIdentityTarget(
        true,
        true,
        { emailAddress: 'member@example.com' },
        'ready',
        null,
        'GB',
      ),
    ).toEqual({ status: 'ready', kind: 'customer', email: 'member@example.com', countryCode: 'GB' });
  });
});

describe('buyer identity synchronization keys', () => {
  it('changes the synchronization key when the access token rotates', () => {
    const target = { status: 'ready', kind: 'customer', email: 'member@example.com', countryCode: 'US' } as const;
    const first = buyerIdentityKey('cart-1', target, fingerprintToken('token-a'));
    const second = buyerIdentityKey('cart-1', target, fingerprintToken('token-b'));

    expect(first).not.toEqual(second);
    expect(first).not.toContain('token-a');
    expect(second).not.toContain('token-b');
  });

  it('produces a stable guest key with no token segment', () => {
    const target = { status: 'ready', kind: 'guest', countryCode: 'US' } as const;
    expect(buyerIdentityKey('cart-1', target)).toBe('cart-1:guest:US:');
  });

  it('treats any completed sync for the same cart/kind/country as ready, regardless of token', () => {
    const target = { status: 'ready', kind: 'customer', email: 'member@example.com', countryCode: 'US' } as const;
    const key = buyerIdentityKey('cart-1', target, fingerprintToken('token-a'));

    expect(buyerIdentityKeyMatchesTarget(key, 'cart-1', target)).toBe(true);
    expect(buyerIdentityKeyMatchesTarget(null, 'cart-1', target)).toBe(false);
    expect(buyerIdentityKeyMatchesTarget('cart-2:customer:US:abc', 'cart-1', target)).toBe(false);
    expect(
      buyerIdentityKeyMatchesTarget(buyerIdentityKey('cart-1', target), 'cart-1', target),
    ).toBe(false); // "<pending>" placeholder never counts as ready
  });
});

describe('buyer identity mutation inputs', () => {
  const customerTarget = {
    status: 'ready',
    kind: 'customer',
    email: 'member@example.com',
    countryCode: 'US',
  } as const;
  const guestTarget = { status: 'ready', kind: 'guest', countryCode: 'US' } as const;

  it('sends only the market country code for a guest, never an email', () => {
    expect(cartCreateBuyerIdentity(guestTarget)).toEqual({ countryCode: 'US' });
    expect(cartCreateBuyerIdentity({ status: 'pending' })).toBeUndefined();
    expect(buyerIdentityUpdateInput(guestTarget)).toEqual({ countryCode: 'US' });
  });

  it('prefers the customer access token when one is available', () => {
    expect(buyerIdentityUpdateInput(customerTarget, 'fresh-token')).toEqual({
      customerAccessToken: 'fresh-token',
      countryCode: 'US',
    });
  });

  it('falls back to the email-based identity when no token is supplied', () => {
    expect(buyerIdentityUpdateInput(customerTarget, null)).toEqual({
      email: 'member@example.com',
      countryCode: 'US',
    });
  });
});

describe('cartDiscountTotal', () => {
  it('sums cart-level discount allocations into a single savings amount', () => {
    const withDiscounts: Cart = {
      ...cart,
      discountAllocations: [
        { discountedAmount: { amount: '5.00', currencyCode: 'USD' }, code: 'WELCOME10' },
        { discountedAmount: { amount: '2.50', currencyCode: 'USD' }, title: 'Automatic discount' },
      ],
    };
    expect(cartDiscountTotal(withDiscounts)).toEqual({ amount: '7.50', currencyCode: 'USD' });
  });

  it('returns null when there are no discount allocations', () => {
    expect(cartDiscountTotal(cart)).toBeNull();
  });
});

describe('fingerprintToken', () => {
  it('never contains the raw token and is stable for the same input', () => {
    const token = 'super-secret-access-token';
    const fingerprint = fingerprintToken(token);

    expect(fingerprint).not.toContain(token);
    expect(fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprintToken(token)).toBe(fingerprint);
    expect(fingerprintToken('a-different-token')).not.toBe(fingerprint);
  });
});
