# Final Fix Wave Report: HeroUI Native Commerce Redesign

## Status

All eleven final whole-branch review findings are implemented and committed on
`feat/heroui-native-ui-redesign`.

- Implementation commit: `4331cda fix: address final commerce review findings`
- Worktree: `/tmp/uhs-mobile-heroui-redesign`
- Baseline before this wave: 19 Jest suites / 108 tests passing
- Final implementation tree: 21 Jest suites / 123 tests passing
- Scope: one coordinated final-review fix wave; no public route was removed and
  the established app-owned component props remain the route-facing API.

## Per-finding implementation and self-review

### 1. Granular HeroUI Native primitives and semantic Uniwind theming

Files:

- `global.css`
- `src/theme/initialize-theme.ts`
- `src/theme/initialize-theme.test.ts`
- `src/components/ui/app-button.tsx`
- `src/components/ui/app-surface.tsx`
- `src/components/ui/app-text.tsx`
- `src/components/ui/app-search-field.tsx`
- `src/components/ui/app-toast.tsx`
- `src/components/ui/status-badge.tsx`
- `src/components/ui/state-view.tsx`
- `src/components/ui/selectable-chip.tsx`
- `src/components/ui/account-menu-row.tsx`
- `src/components/ui/quantity-stepper.tsx`
- `src/components/ui/sticky-action-bar.tsx`
- `src/components/ui/collapsible.tsx`
- `src/components/commerce/service-disclosure.tsx`
- `src/components/ui/commerce-primitives.test.tsx`
- `jest.config.js`, `jest.setup.ts`, `test/testing-library.tsx`

The app-owned API now delegates appropriate behavior to granular imports from
`heroui-native/button`, `surface`, `text`, `search-field`, `alert`, `chip`,
`spinner`, `list-group`, and `accordion`. Semantic Uniwind classes reference
`background`, `foreground`, `surface`, `surface-secondary`, `muted`, `border`,
`accent`, `danger`, and the app's `sale` token. Both light and dark palettes
define the corresponding variables, while runtime initialization updates brand
accent/danger variables and honors `system`, forced `light`, or forced `dark`.

The test renderer mounts the real `HeroUINativeProvider` and Safe Area provider;
Hero components are not replaced by component mocks. Jest only supplies the
native animation/worklet shims and deterministic CSS-variable values needed by
the library runtime.

Boundary retained after self-review: the app owns the composite quantity
stepper because HeroUI Native has no stepper behavior, while its increment and
decrement controls are granular HeroUI Buttons. Expo Router, `expo-image`,
virtualized lists, catalog grids, and route APIs remain app/platform owned.

TDD:

- RED: forced light/dark tests still selected `system`; AppSurface/AppText/
  SearchField/StatusBadge exposed no semantic classes; shared controls were raw
  React Native primitives; the protected AppButton contract was overridable.
- GREEN: the focused shared-component run passed 17/17 tests across
  `commerce-primitives.test.tsx` and `commerce-components.test.tsx`; forced
  theme coverage passed in the auth/theme focused group.
- Integration hardening: enabling real Hero components first exposed expected
  Jest ESM, provider, worklet, and CSS-variable failures. Transform allowlists,
  the real provider wrapper, and deterministic native-runtime shims resolved
  those integration failures without mocking the primitives under test.

### 2. Refresh-aware cold-start and profile retry

Files:

- `src/shopify/auth.tsx`
- `src/shopify/auth-profile.test.tsx`

Cold start and explicit profile retry now obtain credentials through
`getAccessToken()`. A stored token inside its one-minute refresh window is
refreshed before profile fetch; a truly expired token without a refresh token is
cleared rather than sent; and a retry after expiry refreshes before issuing the
new profile request. Token refs are updated immediately when storage, refresh,
or sign-in succeeds so concurrent callbacks do not reuse stale credentials.

TDD:

- RED: an expired stored token was sent unchanged on cold start, an expired
  non-refreshable session remained authenticated, and profile retry reused the
  first access token.
- GREEN: `auth-profile.test.tsx` proves successful cold-start refresh, expired
  non-refreshable cleanup with no profile request, and retry with a refreshed
  Authorization header. The combined auth/theme/account run passed 24/24.

### 3. Cross-line cart full-snapshot ordering

Files:

- `src/shopify/cart.tsx`
- `src/shopify/cart-provider.test.tsx`

Every acknowledged full-cart mutation uses `applyMutationSnapshot()`. If a
newer response has already won locally, the older successful mutation triggers
an authoritative `CART_QUERY` reconciliation rather than being silently
dropped. Existing same-line `QuantityUpdateQueue` target coalescing remains
unchanged.

TDD:

- RED command: `npm test -- --runInBand src/shopify/cart-provider.test.tsx`.
  Reverse resolution produced `[1, 3]` instead of `[2, 3]` and issued no
  reconciliation query.
- GREEN command: `npm test -- --runInBand src/shopify/cart-provider.test.tsx
  src/shopify/cart-operations.test.ts`. Result: 2 suites / 8 tests passed; the
  final cart contains both successful quantities and exactly one deterministic
  reconciliation query follows the stale response.

### 4. Synchronous pagination lock for every entry and retry

Files:

- `src/hooks/use-pagination-lock.ts`
- `src/hooks/use-pagination-lock.test.tsx`
- `src/app/(tabs)/search.tsx`
- `src/app/collection/[handle].tsx`
- `src/app/account/orders.tsx`
- `src/app/account/addresses.tsx`

All four routes use the same callback for `onEndReached` and their pagination
retry action. The hook sets its ref lock synchronously before React Query state
can rerender and calls `fetchNextPage({ cancelRefetch: false })`. It also honors
pre-existing `isFetchingNextPage` and `hasNextPage` state and releases the lock
only when the request settles.

TDD:

- RED: the new focused suite could not resolve `use-pagination-lock`; existing
  routes only checked asynchronously updated query flags and retry bypassed the
  guard.
- GREEN command: `npm test -- --runInBand
  src/hooks/use-pagination-lock.test.tsx
  src/components/commerce/discovery-routes.test.tsx
  src/components/commerce/account-routes.test.tsx`. Result: 3 suites / 29 tests
  passed. Rapid calls return the same in-flight promise and invoke React Query
  once with `cancelRefetch: false`.

### 5. Remaining-only reorder and complete order detail

Files:

- `src/shopify/customer.ts`
- `src/shopify/customer-order-loader.test.ts`
- `src/shopify/order-presentation.ts`
- `src/shopify/order-presentation.test.ts`
- `src/app/account/order/[id].tsx`

`loadCompleteOrder()` requests connection page information, drains all order
line-item pages beyond 50 and fulfillment pages beyond 10, de-duplicates IDs,
and rejects missing/repeated next cursors instead of presenting known-incomplete
detail as complete. `useOrder()` now returns this fully loaded detail.

`addReorderLines()` stops at the first failed input and returns that input plus
the unattempted suffix. Order Detail stores that remainder; its next action is
`Retry remaining items`, so already-added variants are not duplicated. A keyed
OrderContent instance resets recovery state for a different order.

TDD:

- RED: `addReorderLines` and `loadCompleteOrder` did not exist; the prior route
  always restarted the complete input list and the initial GraphQL caps had no
  page information.
- GREEN command: `npm test -- --runInBand
  src/shopify/order-presentation.test.ts
  src/shopify/customer-order-loader.test.ts
  src/components/commerce/account-routes.test.tsx`. Result: 3 suites / 33 tests
  passed. The retry call order is variants `1, 2(fail), 2, 3`, and a synthetic
  large order returns all 60 lines plus all 12 fulfillments over three requests.

### 6. Durable failed-sign-out tombstone

Files:

- `src/shopify/auth.tsx`
- `src/shopify/auth-profile.test.tsx`

Sign-out persists `storefront.customer.signed-out` before SecureStore deletion.
Local tokens, profile state, protected React Query data, analytics/push identity,
and protected navigation are cleared even when secure deletion rejects. Until a
future cleanup succeeds, startup sees the durable tombstone and refuses to
rehydrate the still-persisted credentials. A successful cleanup removes the
tombstone.

TDD:

- RED: after a simulated SecureStore deletion failure, unmount/remount loaded
  the old stored token and requested the private profile again.
- GREEN: the restart test preserves the tombstone, reports signed out, and keeps
  the profile request count unchanged. Its explicit async unmount is awaited so
  the final full suite has no overlapping `act()` warning.

### 7. Jest in CI and accurate README claim

Files:

- `.github/workflows/ci.yml`
- `README.md`

The CI workflow now runs `npm test -- --runInBand` between lint and Expo Doctor.
README no longer claims an ambiguous "first three" commands; it names
typecheck, lint, Jest, and Doctor and accurately describes the `main` push and
pull-request triggers.

RED/GREEN evidence for this declarative finding:

- RED audit: workflow had Typecheck, Lint, and Doctor only while README claimed
  the first three local commands ran in CI (the third listed command was Jest).
- GREEN audit: the workflow contains the exact Jest command, README names the
  four checks, and all commands that can execute in this environment were run
  directly below. Doctor's environment-specific result is recorded verbatim.

### 8. Numeric purchase analytics and UI-only display total

Files:

- `src/shopify/checkout.tsx`
- `src/shopify/checkout-hook.test.tsx`

The `purchase` event now emits a finite numeric `total` and `currency` from the
Checkout Completed event. The localized `displayTotal` remains confined to the
confirmation route parameters.

TDD:

- RED: the event contained `total: "$48.00"` and no currency.
- GREEN: the focused test observes `{ order_id, total: 48, currency: "USD" }`
  while navigation still contains `displayTotal: "$48.00"`.

### 9. Complete OrderCard accessibility name

Files:

- `src/components/ui/order-card.tsx`
- `src/components/commerce/account-routes.test.tsx`

The accessible button name now includes the order name, localized total,
localized date, payment status, and fulfillment status. Protected role/label
props are applied after forwarded interaction props, so the parent label no
longer hides those visible descendants behind `View order <name>`.

TDD:

- RED: the only accessible name was `View order #1001`.
- GREEN: the exact tested name is `Order #1001, $42.00, Aug 20, 2026, Paid,
  Partially fulfilled`; both individual status badges remain reachable.
- Combined checkout/accessibility GREEN: 2 suites / 17 tests passed.

### 10. Protected AppButton role/state/style semantics

Files:

- `src/components/ui/app-button.tsx`
- `src/components/ui/commerce-primitives.test.tsx`

AppButton strips conflicting `role`, `accessibilityRole`, `aria-busy`,
`aria-disabled`, and protected state aliases; applies the semantic button role,
disabled/busy values, and 44-point minimum after caller props/style; and
preserves non-conflicting accessibility-state fields. Caller style callbacks
retain pressed and web-hovered behavior while the final app-owned style cannot
be erased.

TDD:

- Initial RED: caller accessibility role/state/style changed the contract and
  erased `minHeight: 44`.
- Self-review RED: the modern `role="link"` alias still overrode the button even
  after `accessibilityRole` was protected; caller ARIA aliases also replaced the
  busy state.
- GREEN: the focused regression finds a busy, disabled button (not a link),
  retains the caller's non-conflicting margin, and still has `minHeight: 44`.

### 11. OAuth launch overlap prevention

Files:

- `src/components/customer-auth-gate.tsx`
- `src/components/ui/state-view.tsx`
- `src/components/commerce/account-routes.test.tsx`

CustomerAuthGate passes its synchronous `signingIn` state into StateView's
action loading contract. AppButton renders `Opening sign in…` as busy/disabled,
so a second protected-route press cannot launch another OAuth flow.

TDD:

- RED: the protected action remained enabled while a deferred `signIn()` was
  pending. The initial deferred test harness was corrected to retain and later
  resolve the promise rather than awaiting it before making assertions.
- GREEN: while the first promise is pending the action is disabled and a second
  press leaves `signIn` at exactly one call.

## TDD command chronology

Initial review regressions:

```sh
npm test -- --runInBand \
  src/theme/initialize-theme.test.ts \
  src/components/ui/commerce-primitives.test.tsx \
  src/shopify/auth-profile.test.tsx \
  src/components/commerce/account-routes.test.tsx
```

Observed RED: all four suites failed, with 9 failing and 27 passing tests. The
failures covered forced theme selection, semantic classes, protected button
props, refresh-aware token acquisition, durable restart behavior, and OAuth
action locking.

Focused behavior RED/GREEN commands and results are recorded in each finding
above. The final AppButton alias audit deliberately re-entered RED with:

```sh
npm test -- --runInBand src/components/ui/commerce-primitives.test.tsx \
  -t 'keeps button role'
```

It failed because the host node still had `role="link"`, then passed after the
role/ARIA aliases were protected.

## Final verification

Fresh verification after the last production change and before the
implementation commit:

```text
npm test -- --runInBand
  21 suites passed, 123 tests passed, 0 snapshots, 0 failures
  No React act/provider/runtime warnings

npm run typecheck
  exit 0

npm run lint
  exit 0

git diff --check
  exit 0

npx expo config --json --full
  exit 0; valid complete SDK 57 native-only configuration JSON
```

Native exports after the last production change:

```text
npx expo export --platform android \
  --output-dir /tmp/uhs-final-fix-android-final-20260829
  Android Bundled 21.3s, 2621 modules, 6.3 MB Hermes bundle, exit 0

npx expo export --platform ios \
  --output-dir /tmp/uhs-final-fix-ios-final-20260829
  iOS Bundled 20.6s, 2535 modules, 6.1 MB Hermes bundle, exit 0
```

Expo Doctor was attempted exactly as required:

```text
npm run doctor
  > npx --yes expo-doctor@1.19.12
  Error: Failed to parse JSON output from 'npx expo config --json --full'.
  Output: <empty>
```

The direct child command immediately before and after this attempt exits 0 and
returns valid full JSON. This is the same Expo Doctor 1.19.12 child-process
stdout defect recorded in prior task reports, not an Expo project config error.

## Whole-wave self-review

- Re-read every final finding against the implementation after focused GREEN.
- Confirmed all shared Hero-backed imports are granular; there is still exactly
  one root HeroUI provider in app runtime.
- Confirmed semantic classes are backed by light/dark variables and runtime
  brand overrides rather than static-only React Native colors.
- Confirmed auth startup, refresh, retry, explicit sign-out, failed deletion,
  and simulated restart paths all converge on consistent refs/state.
- Confirmed stale full-cart mutation responses reconcile and same-line target
  coalescing remains in place.
- Confirmed Search, Collection, Orders, and Addresses use the same synchronous
  function for end-reached and retry.
- Confirmed Order Detail cannot render a known truncated connection and reorder
  retries only the retained suffix.
- Confirmed purchase analytics and confirmation navigation use separate raw and
  localized values.
- Confirmed OrderCard and AppButton expose complete, protected accessibility
  semantics.
- Confirmed CI/README agree and native-only Expo config/exports are unchanged.

## Concerns and manual follow-up

- Automated blocker: Expo Doctor 1.19.12 cannot consume its child config stdout
  in this environment. Direct config plus both native exports pass.
- No unresolved code-review finding remains.
- Live Shopify Customer Account API pagination on a real order over both caps,
  partial reorder against changing merchandise availability, OAuth/token
  refresh, SecureStore failure behavior, Checkout Completed payloads, and
  PostHog ingestion still merit store/device integration testing.
- VoiceOver/TalkBack, dynamic type, forced light/dark on physical devices, RTL,
  reduced motion, and rapid real-scroll pagination should be exercised through
  the existing manual QA checklist.
