# Task 4 Report: Account, Orders, Addresses, and Final Integration

## Status

Implemented and committed on `feat/heroui-native-ui-redesign`.

- Implementation commit: `6fc0ec8 feat: redesign customer account experience`
- Worktree: `/tmp/uhs-mobile-heroui-redesign`
- Scope: Account tab, protected customer route gate, session-isolated customer
  queries/cache removal, paginated Orders/Addresses, expanded Order Detail,
  hosted address management, shared `OrderCard`/`AppToast`, setup docs, and manual QA.

## Binding rulings

- Every customer query key is rooted at `['customer', customerId, ...]` via
  `customerQueryKey()`. The Shopify customer GID is resolved before protected
  data components mount.
- `CustomerAuthGate` prevents Orders, Order Detail, and Addresses hooks from
  mounting while auth/profile identity is unavailable. Signed-out direct links
  therefore execute no customer hook/request.
- Explicit sign-out and refresh-token invalidation cancel/remove every customer
  query and replace protected navigation with `/account`. Cache/auth/navigation
  clearing still occurs if SecureStore token deletion itself rejects.
- Task 3's `customerProfileStatus`, `customerProfileError`, and
  `retryCustomerProfile()` contract remains intact and is surfaced by both the
  cart buyer-identity path and the new protected-route gate.
- Addresses remain view-only. Native CRUD was not added. A valid configured
  `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_MANAGE_URL` exposes the hosted Shopify
  management handoff; invalid/non-HTTP(S) values expose no action.
- Order queries use fields documented by the Customer Account API `2026-07`:
  `financialStatus`, `fulfillmentStatus`, `cancelledAt`, `fulfillments`,
  `trackingInformation`, line-item image/variant fields, `subtotal`,
  `totalShipping`, `totalTax`, `totalRefunded`, and `totalPrice`.

## TDD evidence

### Initial privacy/presentation RED

Command:

```sh
npm test -- --runInBand src/shopify/customer-session.test.ts src/shopify/order-presentation.test.ts src/components/commerce/account-routes.test.tsx
```

Observed RED:

- `customer-session` and `order-presentation` modules did not exist.
- Addresses and Orders invoked mocked customer hooks before checking sign-in.
- Order Detail invoked its hook without any auth gate.

GREEN after the minimal helper/gate implementation:

- Signed-out Addresses, Orders, and Order Detail each rendered a sign-in action
  and invoked zero customer hooks.
- Session A cached data was absent under session B keys.
- Customer-query clearing retained public catalog data.
- Malformed encoded/non-Shopify IDs and invalid dates returned explicit recovery
  values.
- Pending, partial, fulfilled, cancelled, and refunded cases produced separate
  payment and fulfillment badge values.

### Auth/session RED→GREEN

- RED: the new auth test received no `customerSessionKey`, and sign-out left query
  cache/navigation untouched.
- GREEN: resolved profile ID became the stable query discriminator; sign-out
  removed protected queries and navigated to Account.
- Self-review regression RED: forced `SecureStore.deleteItemAsync()` failure left
  `['customer', ...]` data in cache.
- GREEN: local auth/cache/navigation clearing is unconditional, while the storage
  error still rejects so the UI can report it.

### Account/shared UI RED→GREEN

- RED: Account exposed only `Hi, Morgan`, not full identity/email/accessibility or
  confirmed sign-out.
- GREEN: full identity, accessible Orders/Addresses rows, notification status,
  configured safe links, and progress-aware confirmed sign-out render correctly.
- RED: `OrderCard` was undefined from the shared UI layer.
- GREEN: the exported component presents price, locale date, item summary, and
  independent status badges with a named button target; Orders consumes it.
- RED: `AppToast` module was absent.
- GREEN: it exposes a live alert message and independently reachable optional
  recovery button.

## Automated verification

Fresh final tree evidence before commit:

```text
npm test -- --runInBand
  18 suites passed, 80 tests passed, 0 snapshots, 0 failures

npm run typecheck
  exit 0

npm run lint
  exit 0

git diff --check
  exit 0
```

Native bundle smoke checks after the last production change:

```text
npx expo export --platform ios --output-dir /tmp/uhs-export-task4-final-ios-20260829
  iOS bundle exported successfully

npx expo export --platform android --output-dir /tmp/uhs-export-task4-final-android-20260829
  Android bundle exported successfully
```

Expo Doctor was attempted twice:

```text
npm run doctor
  Error: Failed to parse JSON output from 'npx expo config --json --full'.
  Output: <empty>
```

The exact child commands Doctor claims failed both exit successfully and return
valid complete JSON:

```sh
npx expo config --json --full
EXPO_DEBUG=0 node node_modules/expo/bin/cli config --json --full
```

This is the same Expo Doctor 1.19.12 child-process stdout issue documented in the
Task 2 and Task 3 reports, not a project configuration parse failure.

## Files

### Privacy, auth, and data

- `src/shopify/customer-session.ts`
- `src/shopify/customer-session.test.ts`
- `src/shopify/order-presentation.ts`
- `src/shopify/order-presentation.test.ts`
- `src/shopify/auth.tsx`
- `src/shopify/auth-profile.test.tsx`
- `src/shopify/customer.ts`
- `src/shopify/env.ts`

### Routes and app-owned UI

- `src/components/customer-auth-gate.tsx`
- `src/components/commerce/account-routes.test.tsx`
- `src/components/ui/order-card.tsx`
- `src/components/ui/app-toast.tsx`
- `src/components/ui/index.ts`
- `src/components/ui/commerce-primitives.test.tsx`
- `src/app/(tabs)/account.tsx`
- `src/app/account/addresses.tsx`
- `src/app/account/orders.tsx`
- `src/app/account/order/[id].tsx`

### Configuration and documentation

- `.env.example`
- `README.md`
- `docs/customer-accounts.md`
- `docs/shopify-setup.md`
- `docs/manual-qa.md`

## Self-review

- Audited the complete branch from planning commit `954ee30` against the design:
  native-only platforms remain configured; there is one root HeroUI provider;
  route UI goes through app-owned primitives; catalog/cart/checkout capabilities
  remain present; customer privacy boundaries are explicit; native address CRUD,
  wishlist, reviews, and loyalty were not introduced.
- Audited every Task 4 hunk with `git diff --check` and reviewed query fields
  against Shopify's official Customer Account API `2026-07` Order, LineItem,
  Fulfillment, TrackingInformation, Customer, and CustomerAddress references.
- The audit found and fixed two final-integration shared-layer omissions from the
  approved spec: exported `OrderCard` and accessible `AppToast`.

## Concerns / manual follow-up

- Expo Doctor remains blocked by the known environment-specific bundled child
  stdout defect above. Direct Expo config validation and both native exports pass.
- Live Shopify OAuth/API responses, tracking URLs, hosted management URL, actual
  reorder availability, VoiceOver/TalkBack, dynamic type, RTL, offline recovery,
  deep-link cold starts, and Checkout Sheet recovery require device/store testing.
  The actionable iOS/Android checklist is in `docs/manual-qa.md`.
