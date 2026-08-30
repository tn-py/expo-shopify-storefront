import type { Cart, CartLine } from './types';

export type CartOperationKind = 'add' | 'update' | 'remove' | 'undo' | 'refresh' | 'buyerIdentity';

export interface CartOperationStatus {
  kind: CartOperationKind;
  pending: boolean;
  error: string | null;
}

export interface CartOperationState {
  cart: Cart | null;
  operations: Record<string, CartOperationStatus>;
  lastRemovedLine: CartLine | null;
}

export type CartOperationAction =
  | { type: 'reset' }
  | { type: 'cartChanged'; cart: Cart | null }
  | { type: 'started'; key: string; kind: CartOperationKind }
  | { type: 'completed'; key: string; cart?: Cart | null; removedLine?: CartLine | null; clearRemoved?: boolean }
  | { type: 'failed'; key: string; message: string }
  | { type: 'dismissed'; key: string };

export function createCartOperationState(cart: Cart | null = null): CartOperationState {
  return { cart, operations: {}, lastRemovedLine: null };
}

export function cartOperationReducer(
  state: CartOperationState,
  action: CartOperationAction,
): CartOperationState {
  if (action.type === 'reset') return createCartOperationState();
  if (action.type === 'cartChanged') return { ...state, cart: action.cart };
  if (action.type === 'started') {
    return {
      ...state,
      operations: {
        ...state.operations,
        [action.key]: { kind: action.kind, pending: true, error: null },
      },
    };
  }
  if (action.type === 'failed') {
    const current = state.operations[action.key];
    if (!current) return state;
    return {
      ...state,
      operations: {
        ...state.operations,
        [action.key]: { ...current, pending: false, error: action.message },
      },
    };
  }
  if (action.type === 'dismissed') {
    const operations = { ...state.operations };
    delete operations[action.key];
    return { ...state, operations };
  }

  const current = state.operations[action.key];
  const operations = { ...state.operations };
  if (current) operations[action.key] = { ...current, pending: false, error: null };
  return {
    ...state,
    cart: action.cart === undefined ? state.cart : action.cart,
    operations,
    lastRemovedLine: action.clearRemoved
      ? null
      : action.removedLine === undefined
        ? state.lastRemovedLine
        : action.removedLine,
  };
}

type QuantityWriter = (lineId: string, quantity: number) => Promise<void>;

interface QueuedQuantity {
  desired: number;
  active: Promise<void>;
  write: QuantityWriter;
}

/** Serializes each line independently and drops superseded queued quantities. */
export class QuantityUpdateQueue {
  private readonly entries = new Map<string, QueuedQuantity>();

  constructor(private readonly defaultWrite?: QuantityWriter) {}

  request(lineId: string, quantity: number, writer?: QuantityWriter): Promise<void> {
    const write = writer ?? this.defaultWrite;
    if (!write) return Promise.reject(new Error('A quantity writer is required.'));
    const existing = this.entries.get(lineId);
    if (existing) {
      existing.desired = quantity;
      existing.write = write;
      return existing.active;
    }

    const entry = { desired: quantity, active: Promise.resolve(), write };
    this.entries.set(lineId, entry);
    entry.active = this.drain(lineId, entry);
    return entry.active;
  }

  private async drain(lineId: string, entry: QueuedQuantity): Promise<void> {
    try {
      let sent: number | undefined;
      while (sent !== entry.desired) {
        sent = entry.desired;
        await entry.write(lineId, sent);
      }
    } finally {
      this.entries.delete(lineId);
    }
  }
}

export interface CartSnapshotToken {
  generation: number;
  version: number;
}

type CartIdWriter = (id: string | null) => Promise<void>;

/** Serializes durable cart-ID changes and skips work from invalidated generations. */
export class CartIdPersistenceCoordinator {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly isCurrent: (token: CartSnapshotToken) => boolean,
    private readonly write: CartIdWriter,
  ) {}

  persist(token: CartSnapshotToken, id: string | null): Promise<boolean> {
    const operation = this.tail
      .catch(() => undefined)
      .then(async () => {
        if (!this.isCurrent(token)) return false;
        await this.write(id);
        return this.isCurrent(token);
      });
    this.tail = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

/** Accepts newer snapshots while rejecting stale versions and invalidated work. */
export class CartSnapshotSequencer {
  private nextVersion = 0;
  private appliedVersion = 0;
  private generation = 0;

  begin(): CartSnapshotToken {
    this.nextVersion += 1;
    return { generation: this.generation, version: this.nextVersion };
  }

  isCurrent(token: CartSnapshotToken): boolean {
    return token.generation === this.generation;
  }

  accept(token: CartSnapshotToken): boolean {
    if (!this.isCurrent(token) || token.version < this.appliedVersion) return false;
    this.appliedVersion = token.version;
    return true;
  }

  invalidate(): void {
    this.generation += 1;
    this.appliedVersion = this.nextVersion;
  }
}

export type BuyerIdentityTarget =
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'ready'; email: string | null };

export function resolveBuyerIdentityTarget(
  authReady: boolean,
  isAuthenticated: boolean,
  customer: { emailAddress: string | null } | null,
  customerProfileStatus?: 'idle' | 'loading' | 'ready' | 'error',
  customerProfileError?: string | null,
): BuyerIdentityTarget {
  if (!authReady) return { status: 'pending' };
  if (isAuthenticated && customerProfileStatus === 'error') {
    return {
      status: 'error',
      message:
        customerProfileError ??
        'We couldn’t load your customer profile. Check your connection and try again.',
    };
  }
  if (isAuthenticated && !customer) return { status: 'pending' };
  return { status: 'ready', email: isAuthenticated ? customer?.emailAddress ?? null : null };
}

export function buyerIdentityKey(cartId: string, target: Extract<BuyerIdentityTarget, { status: 'ready' }>): string {
  return `${cartId}:${target.email ?? '<guest>'}`;
}

export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
}

export function removalUndoInput(line: CartLine): CartLineInput {
  return { merchandiseId: line.merchandise.id, quantity: line.quantity };
}

export async function recoverStaleCart(
  previousCart: Cart,
  fetchCart: (id: string) => Promise<Cart | null>,
  recreateCart: (lines: CartLineInput[]) => Promise<Cart | null>,
): Promise<Cart | null> {
  const refreshed = await fetchCart(previousCart.id);
  if (refreshed) return refreshed;
  const lines = previousCart.lines.nodes.map(removalUndoInput);
  return lines.length ? recreateCart(lines) : null;
}

export function cartErrorMessage(kind: CartOperationKind): string {
  if (kind === 'update') return 'We couldn’t update this quantity. Try again.';
  if (kind === 'remove') return 'We couldn’t remove this item. It’s still in your cart.';
  if (kind === 'undo') return 'We couldn’t restore this item. Try again.';
  if (kind === 'buyerIdentity') return 'We couldn’t prepare your signed-in checkout. Try again.';
  if (kind === 'refresh') return 'We couldn’t refresh your cart. Check your connection and try again.';
  return 'We couldn’t update your cart. Try again.';
}
