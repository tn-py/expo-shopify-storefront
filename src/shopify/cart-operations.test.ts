import type { Cart, CartLine } from './types';
import {
  cartOperationReducer,
  createCartOperationState,
  QuantityUpdateQueue,
  removalUndoInput,
  recoverStaleCart,
} from './cart-operations';

const money = { amount: '20.00', currencyCode: 'USD' };
const line: CartLine = {
  id: 'line-1',
  quantity: 2,
  cost: { totalAmount: { amount: '40.00', currencyCode: 'USD' }, amountPerQuantity: money },
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
  cost: { subtotalAmount: { amount: '40.00', currencyCode: 'USD' }, totalAmount: { amount: '40.00', currencyCode: 'USD' }, totalTaxAmount: null },
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
});
