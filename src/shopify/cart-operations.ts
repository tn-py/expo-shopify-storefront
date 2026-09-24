import type { Cart, CartLine, CartWarning, Money } from './types';

export type CartOperationKind =
  | 'add'
  | 'update'
  | 'remove'
  | 'undo'
  | 'refresh'
  | 'buyerIdentity'
  | 'discount';

export interface CartOperationStatus {
  kind: CartOperationKind;
  pending: boolean;
  error: string | null;
}

export interface CartOperationState {
  cart: Cart | null;
  operations: Record<string, CartOperationStatus>;
  lastRemovedLine: CartLine | null;
  warnings: CartWarning[];
}

export type CartOperationAction =
  | { type: 'reset' }
  | { type: 'cartChanged'; cart: Cart | null }
  | { type: 'started'; key: string; kind: CartOperationKind }
  | {
      type: 'completed';
      key: string;
      cart?: Cart | null;
      removedLine?: CartLine | null;
      clearRemoved?: boolean;
    }
  | { type: 'failed'; key: string; message: string }
  | { type: 'dismissed'; key: string }
  | { type: 'warningsReceived'; warnings: CartWarning[] }
  | { type: 'warningsDismissed' };

export function createCartOperationState(cart: Cart | null = null): CartOperationState {
  return { cart, operations: {}, lastRemovedLine: null, warnings: [] };
}

export function cartOperationReducer(
  state: CartOperationState,
  action: CartOperationAction,
): CartOperationState {
  if (action.type === 'reset') return createCartOperationState();
  if (action.type === 'cartChanged') return { ...state, cart: action.cart };
  if (action.type === 'warningsDismissed') return { ...state, warnings: [] };
  if (action.type === 'warningsReceived') {
    return action.warnings.length ? { ...state, warnings: action.warnings } : state;
  }
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
  | { status: 'ready'; kind: 'guest'; countryCode: string | null }
  | { status: 'ready'; kind: 'customer'; email: string | null; countryCode: string | null };

type ReadyBuyerIdentityTarget = Extract<BuyerIdentityTarget, { status: 'ready' }>;

/**
 * Resolves what the cart's buyer identity should be from auth state. Pure so
 * it's directly unit-testable; the actual customer access token is fetched
 * fresh (and may rotate) inside `CartProvider.syncBuyerIdentity`, not here.
 */
export function resolveBuyerIdentityTarget(
  authReady: boolean,
  isAuthenticated: boolean,
  customer: { emailAddress: string | null } | null,
  customerProfileStatus?: 'idle' | 'loading' | 'ready' | 'error',
  customerProfileError?: string | null,
  countryCode: string | null = null,
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
  if (isAuthenticated) {
    return { status: 'ready', kind: 'customer', email: customer?.emailAddress ?? null, countryCode };
  }
  return { status: 'ready', kind: 'guest', countryCode };
}

function buyerIdentityKeyPrefix(cartId: string, target: ReadyBuyerIdentityTarget): string {
  return `${cartId}:${target.kind}:${target.countryCode ?? '<default>'}:`;
}

/**
 * The synchronization key for a buyer identity sync attempt. For a signed-in
 * customer this must change whenever the access token rotates, so the caller
 * passes a short, non-reversible fingerprint of the token (see
 * `fingerprintToken`) rather than the raw token — the key is never persisted
 * or logged, but keeping the raw token out of it is cheap insurance.
 */
export function buyerIdentityKey(
  cartId: string,
  target: ReadyBuyerIdentityTarget,
  tokenFingerprint?: string,
): string {
  const prefix = buyerIdentityKeyPrefix(cartId, target);
  if (target.kind === 'guest') return prefix;
  return `${prefix}${tokenFingerprint ?? '<pending>'}`;
}

/**
 * Looser than an exact `buyerIdentityKey` match: true once *any* sync has
 * completed for the current cart + identity kind + country, regardless of
 * which token fingerprint it used. UI readiness doesn't need token-level
 * precision — `useCheckout` re-syncs with a fresh token immediately before
 * presenting checkout.
 */
export function buyerIdentityKeyMatchesTarget(
  key: string | null,
  cartId: string,
  target: ReadyBuyerIdentityTarget,
): boolean {
  if (!key) return false;
  if (target.kind === 'guest') return key === buyerIdentityKeyPrefix(cartId, target);
  return key.startsWith(buyerIdentityKeyPrefix(cartId, target)) && !key.endsWith(':<pending>');
}

export interface BuyerIdentityMutationInput {
  email?: string;
  customerAccessToken?: string;
  countryCode?: string;
}

/** `buyerIdentity` input for `cartCreate` — country only; the token is attached by a follow-up sync. */
export function cartCreateBuyerIdentity(target: BuyerIdentityTarget): { countryCode?: string } | undefined {
  if (target.status !== 'ready') return undefined;
  return target.countryCode ? { countryCode: target.countryCode } : {};
}

/**
 * `buyerIdentity` input for `cartBuyerIdentityUpdate`. Pass a fresh customer
 * access token to associate a logged-in checkout; pass `null` (or omit) to
 * fall back to the email-based identity, e.g. after Shopify rejects the
 * token with `userErrors`.
 */
export function buyerIdentityUpdateInput(
  target: ReadyBuyerIdentityTarget,
  token?: string | null,
): BuyerIdentityMutationInput {
  const countryCode = target.countryCode ?? undefined;
  if (target.kind === 'guest') return countryCode ? { countryCode } : {};
  return token
    ? { customerAccessToken: token, ...(countryCode ? { countryCode } : {}) }
    : { email: target.email ?? undefined, ...(countryCode ? { countryCode } : {}) };
}

/**
 * A short, non-reversible fingerprint (FNV-1a, 8 hex chars) of an access
 * token — good enough to detect rotation for a synchronization key without
 * storing or logging the raw token.
 */
export function fingerprintToken(token: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
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

/** Total cart-level discount savings, or `null` when there are none to show. */
export function cartDiscountTotal(cart: Pick<Cart, 'discountAllocations' | 'cost'>): Money | null {
  if (!cart.discountAllocations.length) return null;
  const amount = cart.discountAllocations.reduce(
    (sum, allocation) => sum + Number(allocation.discountedAmount.amount),
    0,
  );
  return amount > 0 ? { amount: amount.toFixed(2), currencyCode: cart.cost.totalAmount.currencyCode } : null;
}

export function cartErrorMessage(kind: CartOperationKind): string {
  if (kind === 'update') return 'We couldn’t update this quantity. Try again.';
  if (kind === 'remove') return 'We couldn’t remove this item. It’s still in your cart.';
  if (kind === 'undo') return 'We couldn’t restore this item. Try again.';
  if (kind === 'buyerIdentity') return 'We couldn’t prepare your signed-in checkout. Try again.';
  if (kind === 'discount') return 'We couldn’t update your discount code. Try again.';
  if (kind === 'refresh') return 'We couldn’t refresh your cart. Check your connection and try again.';
  return 'We couldn’t update your cart. Try again.';
}
