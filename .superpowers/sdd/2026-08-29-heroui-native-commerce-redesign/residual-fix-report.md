# Residual Fix Report: Clear-Local Epoch and Toast Accessibility

## Status

Both residual blockers are fixed on `feat/heroui-native-ui-redesign` in
`/tmp/uhs-mobile-heroui-redesign`.

- Planned commit subject: `fix: preserve cart clears and toast accessibility`
- Scope: cart mutation invalidation across `clearLocal()` and independently
  reachable inline-toast alert/action semantics.
- No push, PR, or merge was performed.

## 1. Cleared cart restored by an older mutation

### Root cause

`CartSnapshotSequencer.invalidate()` only advanced the accepted numeric version.
When a mutation begun before `clearLocal()` later resolved, its old version was
correctly rejected by `applyCartSnapshot()`. However,
`applyMutationSnapshot()` interpreted every rejection as an ordinary same-cart
ordering race, began a new post-clear reconciliation version, fetched
`CART_QUERY`, and accepted that fresh version. The authoritative response then
repopulated the intentionally cleared local cart.

The version number could express response ordering, but not the lifecycle
boundary between the old cart and the post-clear state.

### TDD RED

Added a provider-level regression in `src/shopify/cart-provider.test.tsx`:

1. Rehydrate `cart-1`.
2. Start a line quantity mutation and hold its Storefront response.
3. Call and await `clearLocal()`.
4. Resolve the old mutation.
5. Assert the cart remains `null`, the simulated persisted cart ID remains
   removed, and only the initial hydration `CART_QUERY` occurred.

Focused RED command:

```sh
npm test -- --runInBand \
  src/shopify/cart-provider.test.tsx \
  src/components/ui/commerce-primitives.test.tsx
```

Observed failure:

```text
CartProvider snapshot ordering
  does not let a mutation started before clearLocal restore the cleared cart

Expected: null
Received: cart-1 snapshot
```

The request counter also demonstrated the unwanted second `CART_QUERY` through
the old mutation's reconciliation path.

### Minimal implementation

Files:

- `src/shopify/cart-operations.ts`
- `src/shopify/cart.tsx`
- `src/shopify/cart-provider.test.tsx`

`CartSnapshotSequencer.begin()` now returns a `CartSnapshotToken` containing:

- a monotonically increasing version for ordering responses within one cart
  lifecycle; and
- a generation for the lifecycle itself.

`invalidate()` advances the generation. `accept()` rejects tokens from an older
generation before considering their version. `applyMutationSnapshot()` checks
the generation before applying and checks it again before entering the
same-generation reconciliation path. Thus:

- two different line mutations from the current generation still use the
  existing deterministic reconciliation behavior when responses resolve in
  reverse order; and
- mutation work begun before a clear can neither apply nor start a new
  reconciliation after the clear.

The create-cart branch also checks the token around cart-ID persistence. If a
clear occurs while a new cart ID is being stored, it removes that ID again and
does not apply the stale cart.

### GREEN evidence

```text
npm test -- --runInBand \
  src/shopify/cart-provider.test.tsx \
  src/shopify/cart-operations.test.ts \
  src/components/ui/commerce-primitives.test.tsx

3 suites passed, 21 tests passed, 0 failures
```

The new clear-race test passes, and the existing reverse cross-line test still
proves both successful quantities survive through one reconciliation query.

## 2. Toast Alert grouped its recovery button

### Root cause

`AppToast` rendered the HeroUI `Alert` root with `accessible` and
`accessibilityRole="alert"`. Because the recovery `AppButton` was a descendant
of that accessible container, VoiceOver/TalkBack could treat the complete Alert
as one grouped accessibility element and hide or conflate the independently
actionable Retry control.

The HeroUI root is needed for the visual surface, but the alert announcement
belongs to the message, not the container that also owns an action.

### TDD RED

Changed the AppToast regression to require:

- an element with alert semantics containing the exact message;
- `accessibilityLiveRegion="polite"` on that message alert;
- no button inside the alert accessibility element;
- a separate named Retry button whose press still calls the recovery handler.

The same focused RED command above failed because `getByRole('alert')` returned
the accessible HeroUI root, and that root contained the Retry button.

### Minimal implementation

Files:

- `src/components/ui/app-toast.tsx`
- `src/components/ui/commerce-primitives.test.tsx`

The HeroUI Alert remains the visual component, but its root is explicitly
`accessible={false}` with `role="none"`. Alert semantics now live on
`Alert.Description`, which is an accessible text element with both the native
alert role and a polite live region. `AppButton` stays a sibling within the
visual content and therefore remains an independently navigable button.

### GREEN evidence

The focused 3-suite / 21-test run above passed with no warnings. The test finds
one message alert, finds Retry as a separate button, verifies no button is
nested in the alert accessibility element, and successfully invokes the action.

## Final verification

Fresh commands after the last production change:

```text
npm test -- --runInBand
  21 suites passed, 124 tests passed, 0 snapshots, 0 failures

npm run typecheck
  exit 0

npm run lint
  exit 0

git diff --check
  exit 0
```

Native bundle verification:

```text
npx expo export --platform android \
  --output-dir /tmp/uhs-residual-fix-android-20260830
  Android bundled 2621 modules; 6.3 MB Hermes bundle; exit 0

npx expo export --platform ios \
  --output-dir /tmp/uhs-residual-fix-ios-20260830
  iOS bundled 2535 modules; 6.1 MB Hermes bundle; exit 0
```

## Self-review and concerns

- Confirmed `clearLocal()` invalidates the generation before clearing refs,
  reducer state, and persisted ID.
- Confirmed every existing snapshot producer receives a token and therefore
  rejects work from an invalidated generation.
- Confirmed the same-generation version ordering remains unchanged, preserving
  the current cross-line reconciliation fix.
- Confirmed create-cart persistence cannot leave a stale ID after a concurrent
  clear.
- Confirmed the HeroUI Alert remains in the rendered visual hierarchy while its
  root is not an accessibility grouping element.
- Confirmed message announcement and recovery action are independent and the
  recovery callback remains functional.

No automated blocker remains. Physical-device VoiceOver/TalkBack announcement
timing and a live Storefront mutation racing Checkout Completed cart clearing
remain appropriate final integration checks.

---

## Addendum: Serialized generation-aware cart-ID persistence

### Status

The remaining durable-storage race is fixed on
`feat/heroui-native-ui-redesign`. This addendum supersedes the earlier, narrower
claim that create-cart persistence was safe after a concurrent clear.

- Planned commit subject: `fix: serialize cart ID persistence`
- Scope: ordering of old create writes, cart-clear removals, and new-generation
  create writes to `storefront.cart.id`.
- No push, PR, or merge was performed.

### Root cause

Snapshot generations prevented an old remote cart response from returning to
React state, but `persistId()` still sent independent calls directly to
AsyncStorage. There were two durable-state schedules that generation checks
alone did not protect:

1. An old-generation create entered a delayed `setItem`. `clearLocal()` then
   invalidated it and a new-generation create stored `cart-new`. When the old
   `setItem` eventually returned, the stale branch unconditionally called
   `removeItem`, deleting the valid new ID.
2. `clearLocal()` entered a delayed `removeItem` and was intentionally not
   awaited. A subsequent new-generation create stored `cart-new`, after which
   the old removal completed and deleted it.

The in-memory generation boundary remained correct in both schedules. The
failure was isolated to the unordered asynchronous storage boundary.

### TDD RED

Files:

- `src/shopify/cart-provider.test.tsx`

Added two provider-level schedules using controlled AsyncStorage promises:

- `keeps a new cart ID when an old create persistence finishes after a clear`
  starts `cart-old`, holds its `setItem`, calls `clearLocal()` without awaiting
  it, starts `cart-new`, then releases the old write.
- `keeps a new cart ID when a delayed clear persistence finishes later` holds
  the clear's `removeItem`, immediately starts `cart-new`, then releases the
  removal.

Both tests assert the consumer-visible contract: memory and durable storage end
with exactly `cart-new`. They do not rely on private coordinator structure.

RED command:

```text
npm test -- --runInBand src/shopify/cart-provider.test.tsx
```

Observed RED:

```text
CartProvider snapshot ordering
  ✕ keeps a new cart ID when an old create persistence finishes after a clear
  ✕ keeps a new cart ID when a delayed clear persistence finishes later

Expected: "cart-new"
Received: null

1 suite failed; 2 tests failed, 4 passed
```

The in-memory `cart.id` assertion passed in each case; only the simulated
AsyncStorage value failed, confirming the diagnosis.

### Minimal implementation

Files:

- `src/shopify/cart-operations.ts`
- `src/shopify/cart.tsx`
- `src/shopify/cart-provider.test.tsx`

`CartIdPersistenceCoordinator` now owns one promise tail for every durable
cart-ID operation. Each queued operation:

1. waits for the prior storage operation, recovering the queue if that caller
   received an AsyncStorage error;
2. checks that its `CartSnapshotToken` still belongs to the current generation;
3. performs either the ID write or removal; and
4. reports whether its generation remained current while the write was in
   flight.

This ordering makes an already-running stale write harmless: the current
generation's clear and new-cart write execute after it, in invocation order.
Work that is already stale when its queue slot opens is skipped. The old create
path now returns when persistence reports a stale token and never issues an
unconditional cleanup removal.

Every existing cart-ID persistence caller now supplies the snapshot token that
authorized it: rehydration cleanup, reconciliation cleanup, refresh cleanup,
cart creation, stale-cart recovery, and local clear. `clearLocal()` invalidates
the snapshot generation synchronously, creates the new-generation clear token,
clears refs/state, and enqueues the removal before its first `await`. Therefore
Checkout Completed remains safe when it calls `void clearLocal()` and navigates
immediately: a later new create can only enqueue its ID write after that clear.

### GREEN evidence

Focused command:

```text
npm test -- --runInBand \
  src/shopify/cart-provider.test.tsx \
  src/shopify/cart-operations.test.ts

2 suites passed, 11 tests passed, 0 failures
```

The two new schedules pass. The existing old-mutation-after-clear regression
still keeps memory/storage empty without reconciliation, and the reverse
cross-line response regression still preserves both successful quantities.

### Final verification

Fresh commands after the last production change:

```text
npm test -- --runInBand
  21 suites passed, 126 tests passed, 0 snapshots, 0 failures

npm run typecheck
  exit 0

npm run lint
  exit 0

git diff --check
  exit 0
```

Native exports:

```text
npx expo export --platform android \
  --output-dir /tmp/uhs-persistence-race-android-20260830
  Android bundled 2621 modules; 6.3 MB Hermes bundle; exit 0

npx expo export --platform ios \
  --output-dir /tmp/uhs-persistence-race-ios-20260830
  iOS bundled 2535 modules; 6.1 MB Hermes bundle; exit 0
```

Both Metro runs emitted only the existing environment warning that `NO_COLOR`
is ignored because `FORCE_COLOR` is set.

### Self-review and concerns

- Durable cart-ID writes/removals have one ordering authority; no direct
  cart-ID `setItem`/`removeItem` call remains outside its writer.
- An invalidated operation cannot start a new durable write when its queue slot
  opens.
- A write invalidated while already running cannot finish after the current
  generation's queued clear/new write.
- Storage failures are still delivered to the initiating caller but do not
  poison later queue entries.
- Snapshot ordering and cross-line reconciliation behavior are unchanged.
- Checkout completion still clears refs and reducer state synchronously, and
  its fire-and-forget durable removal is ordered before any subsequent create.

No automated blocker remains. A physical-device checkout-completion/new-cart
race against real AsyncStorage remains an appropriate final integration check.
