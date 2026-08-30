# HeroUI Native Commerce Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a professional neutral-premium Shopify storefront for native iOS and Android using HeroUI Native behind app-owned commerce components.

**Architecture:** Install HeroUI Native and Uniwind at the root, synchronize environment branding into semantic themes, and migrate routes through a reusable commerce UI layer. Deliver foundation, discovery, conversion, and account/post-purchase as independently testable slices.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, HeroUI Native, Uniwind/Tailwind CSS v4, Shopify Storefront and Customer Account APIs, React Query, Jest Expo, React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-29-heroui-native-commerce-redesign-design.md`

## Global Constraints

- Work on branch `feat/heroui-native-ui-redesign`; do not modify the user's dirty main checkout.
- Support iOS and Android only; remove Expo web support and documentation.
- Use granular HeroUI Native imports consistently and exactly one root provider.
- Route files consume app-owned semantic commerce components; Expo Router, Shopify Checkout Sheet, `expo-image`, and native virtualized lists remain in place.
- Use system typography with font scaling enabled and 44-point minimum interactive targets.
- Keep brand colors environment-driven and synchronized across Uniwind, navigation, StatusBar, Checkout Sheet, and notification configuration.
- Follow TDD for behavior and components: record a focused failing test before production implementation, then make it pass.
- Do not add wishlist, reviews, loyalty, or full native address CRUD.
- Before every task commit run focused tests plus `npm run typecheck` and `npm run lint`; run the full test suite once per task.

---

### Task 1: Native HeroUI Foundation and Commerce Primitives

**Files:**
- Modify: `package.json`, `package-lock.json`, `app.config.ts`, `src/app/_layout.tsx`, `src/constants/theme.ts`, `README.md`, `.env.example`
- Create: `global.css`, `metro.config.js`, `src/uniwind.d.ts`, `src/theme/initialize-theme.ts`, `src/theme/initialize-theme.test.ts`, `src/components/ui/*`, `jest.config.js`, `jest.setup.ts`
- Remove: `src/hooks/use-color-scheme.web.ts` and unused web-only assets/dependencies

**Interfaces:**
- Produces `AppText`, `AppButton`, `AppSurface`, `AppSearchField`, `StateView`, `StickyActionBar`, `RemoteImage`, `Price`, `StatusBadge`, `QuantityStepper`, `SelectableChip`, `CatalogGrid`, and `AccountMenuRow`.
- Produces `initializeTheme(): void`, which applies `Brand.primary`, `Brand.onPrimary`, and `Brand.sale` to both Uniwind themes and synchronizes `EXPO_PUBLIC_APP_COLOR_SCHEME`.

- [ ] Add Jest Expo and React Native Testing Library configuration; add `test` and working `doctor` scripts.
- [ ] Write failing tests for theme initialization and shared controls' variants, loading/disabled behavior, 44-point targets, and accessibility state.
- [ ] Run the focused tests and confirm failure because the new interfaces do not exist.
- [ ] Install/configure HeroUI Native, Uniwind, Tailwind CSS, required peers, root CSS, Metro integration, and the single root provider using granular imports.
- [ ] Replace Montserrat with platform system typography and remove web dependencies/configuration.
- [ ] Implement the semantic UI primitives and adapt existing themed/state helpers through them so downstream screens have a stable migration surface.
- [ ] Run focused tests, full tests, typecheck, lint, Doctor, and native export smoke checks; commit the slice.

### Task 2: Configurable Discovery and Product Experience

**Files:**
- Create: `src/config/storefront-ui.ts`, `src/config/storefront-ui.test.ts`, focused files under `src/components/commerce/`
- Modify: Home, Shop, Search, Collection, and Product routes; `src/shopify/hooks.ts`, `queries.ts`, and `types.ts`; shared product/state components

**Interfaces:**
- Produces the `HomeSectionConfig` discriminated union and `StorefrontUIConfig` defined by the spec.
- Produces pure `resolveVariantSelection(product, selection)` and `getAvailableOptionValues(product, selection, optionName)` helpers.
- Produces commerce cards and grids shared by Home, Shop, Search, Collection, and Product.

- [ ] Write failing tests for configuration fallbacks, valid initial variant selection, impossible option disabling, submitted-search separation, and pagination gating.
- [ ] Run focused tests and confirm the intended missing/incorrect behavior.
- [ ] Implement typed homepage configuration with optional announcement, hero, collections, products, and trust sections plus Shopify-backed fallbacks.
- [ ] Rebuild Home and Shop with shared cards, adaptive grids, intentional merchandising hierarchy, and route analytics.
- [ ] Rebuild Search so predictive suggestions remain distinct from submitted results; add clear, count, skeleton, empty, error, and pagination states.
- [ ] Rebuild Collection with on-page context, count, supported Shopify filters, friendly sort presentation, adaptive grid, and guarded pagination.
- [ ] Rebuild Product with a responsive non-nested gallery, valid variant state, unavailable values, stock/savings, quantity, service accordions, sticky CTA, and recoverable add-to-cart feedback.
- [ ] Test loading, error, not-found, empty, long-content, accessibility, and phone/tablet behavior; run full verification and commit.

### Task 3: Cart, Checkout, and Confirmation

**Files:**
- Modify: `src/shopify/cart.tsx`, `src/shopify/checkout.tsx`, cart and confirmation routes, Shopify cart queries/types, analytics
- Create: focused cart operation helpers/tests and conversion component tests

**Interfaces:**
- Cart operations expose operation-specific pending/error state instead of only a single global busy flag.
- Checkout exposes presenting/error/recovered state and a signed-in buyer-identity synchronization path.
- Confirmation accepts only non-sensitive completion details: order identifier/name, display total, customer email when supplied by Shopify, and authentication context.

- [ ] Write failing tests for mutation failure recovery, rapid quantity updates, removal undo, checkout double-present prevention, stale-cart recovery, and guest/member confirmation copy.
- [ ] Run focused tests and confirm failures against current behavior.
- [ ] Rebuild cart line items, quantity controls, remove/undo, empty state, summary, reassurance, and sticky checkout using shared commerce components.
- [ ] Preserve coherent cart state on failure, render plain-language retry feedback, and label totals as estimated until Shopify Checkout finalizes them.
- [ ] Synchronize supported authenticated buyer identity, guard Checkout Sheet presentation, and map checkout events/errors into recoverable UI and analytics.
- [ ] Rebuild confirmation with contextual order details, accessible success semantics, accurate guest/member actions, support, and continue-shopping action.
- [ ] Run focused and full verification, including forced network/API failures; commit.

### Task 4: Account, Orders, Addresses, and Final Integration

**Files:**
- Modify: account, addresses, orders, and order detail routes; `src/shopify/auth.tsx`, `customer.ts`, related types/config/docs
- Create: customer session/cache helpers and tests; order status/presentation helpers and tests

**Interfaces:**
- Customer query keys include a stable session/customer discriminator and all customer queries are removed on sign-out.
- Protected routes render an authenticated gate before issuing customer requests.
- Order presentation maps payment and fulfillment data into separate customer-facing `StatusBadge` values.

- [ ] Write failing tests proving customer A data cannot appear after switching to customer B, protected routes do not query while signed out, malformed order IDs/dates recover safely, and order status mapping handles pending/partial/fulfilled/cancelled/refunded cases.
- [ ] Run focused tests and confirm the current privacy/state failures.
- [ ] Rebuild Account with identity, signed-out/unconfigured states, accessible menu rows, safe configured links, notification status, and confirmed progress-aware sign-out.
- [ ] Rebuild Addresses as an accurate saved-address view with locale formatting, pagination, default status, and working sign-in/account-management recovery actions; do not add native CRUD.
- [ ] Expand and rebuild Orders and Order Detail with fulfillment/tracking, shipment, cost breakdown, item media/variants, locale dates, pagination recovery, and support/reorder actions.
- [ ] Clear customer caches and protected navigation on sign-out; verify direct deep links cannot reveal stale data.
- [ ] Update README/setup documentation and add the full iOS/Android visual/accessibility QA checklist.
- [ ] Run all tests, typecheck, lint, Doctor, native export smoke checks, and inspect the complete branch diff against the spec; commit.
