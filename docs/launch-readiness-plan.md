# Launch-readiness plan (Sept 2026)

Audit of the template against the current Shopify mobile platform and Expo SDK 57,
followed by the implementation plan used to get the repo ready for a public launch.

## 1. Baseline

- Expo SDK 57 / RN 0.86 / React 19.2, Expo Router typed routes, React Compiler,
  HeroUI Native + Uniwind, React Query, Storefront API `2026-07` (latest stable),
  Checkout Sheet Kit 3.9, Customer Account API (OAuth + PKCE), PostHog, OneSignal.
- `tsc`, `expo lint`, and 126 Jest tests pass. The cart concurrency model
  (snapshot sequencer, per-line quantity queue, persistence coordinator) is well
  engineered and tested. Don't redesign it; extend it.

## 2. What changed in the platform (research)

| Area | Current state (Sept 2026) | Impact on the template |
| --- | --- | --- |
| Checkout Kit | `@shopify/checkout-sheet-kit` 3.9 is the stable line. Shopify is renaming it to **Checkout Kit**; v4 (`@shopify/checkout-kit`, New Arch only) is **alpha, not production-ready**. | Stay on 3.9. Document the v4 migration in the roadmap. |
| Accelerated checkouts | Shop Pay and Apple Pay buttons (`AcceleratedCheckoutButtons`) ship in 3.9 for **iOS 16+** (no Android yet). They need the `write_cart_wallet_payments` scope, which merchants request from Shopify, plus an Apple merchant id for Apple Pay. | Add as an **opt-in** feature on cart + PDP. |
| Authenticated checkout | A Customer Account API access token can be set as `buyerIdentity.customerAccessToken` on the cart, which gives a logged-in checkout with **vaulted cards, store credit, and saved addresses**. | The app only sets `email` today, so signed-in buyers get a guest checkout. **High-value fix.** |
| Customer Account API logout | Mobile clients can call the logout endpoint as an API call (200 OK). | Sign-out currently leaves the Shopify session alive. |
| Storefront API 2026-07 | Latest stable. `CartLine.viewKey` added. `CartCost.totalTaxAmount` / `totalDutyAmount` are deprecated. Cart mutations return `warnings`. | Remove deprecated fields; surface warnings. |
| Markets | `@inContext(country, language)` localizes prices, availability, and translated content. | `expo-localization` is installed but unused, and money is formatted as `en-US`. Wire up locale. |
| mock.shop | Public Storefront-API mock, no token. | Instant **demo mode** for people evaluating the template. |
| Agentic commerce (UCP, Catalog/Cart/Checkout MCP) | Big 2026 theme; server/agent-side. | Roadmap only. Out of scope for a native client template. |
| Expo SDK 57 | Non-breaking release (RN 0.86). `NativeTabs` still `unstable-native-tabs` (stable in SDK 58). | Keep JS tabs; NativeTabs goes on the roadmap for SDK 58. |

## 3. Findings

### Architecture / tech stack
1. **Unused dependencies add native weight and review questions:** `@expo/ui`,
   `expo-glass-effect`, `expo-symbols`, `expo-device`, `expo-application`,
   `expo-tracking-transparency` (plus its plugin and the Android `AD_ID` permission,
   which the app never uses), and `expo-notifications` (plugin only; OneSignal
   handles push). Note: `@gorhom/bottom-sheet`, `expo-blur`, `react-native-svg`,
   and `tailwind-*` are heroui-native peers, so they stay.
2. **No OTA updates.** `eas.json` declares channels, but `expo-updates` isn't
   installed, so channels do nothing.
3. **No crash reporting.** Add optional Sentry, following the same no-op-without-env
   pattern as analytics and push.
4. **React Query isn't wired for React Native.** It lacks the AppState focus manager
   and the online manager.
5. **Dead code and create-expo-app leftovers:** `themed-text`, `themed-view`,
   `components/product-card.tsx` (re-export), `scripts/reset-project.js` (a
   destructive script that makes no sense in this template), and internal agent
   artifacts (`.superpowers/`, `docs/superpowers/`).
6. **Privacy:** PostHog `identify()` uses the **email** as the distinct id. Use the
   Shopify customer GID instead.
7. **Export compliance:** `ITSAppUsesNonExemptEncryption` is unset, so every App
   Store upload prompts for it.

### Commerce
8. Signed-in checkout isn't authenticated (see §2). Sign-out doesn't end the
   Shopify session, and it leaves the customer identity on the cart.
9. No discount-code entry in the cart. No discount allocations displayed.
10. Deprecated `totalTaxAmount` is still queried. Cart `warnings` are ignored.
11. No product recommendations on the PDP (`productRecommendations`).
12. No Markets / locale context. Money is hard-coded to `en-US`.

### UI / UX
13. The PDP shows a spinner instead of instant content. Cards should prefetch on
    press-in and seed the PDP with card data.
14. The PDP has no share action, no haptics, no page indicator on the gallery, and no
    "View cart" affordance after adding.
15. No wishlist / saved items (the most-requested template feature, and already in the
    README roadmap). No recent searches.

### Project / launch
16. With no store configured, people see a setup wall. A mock.shop demo mode lets
    them try the app in about 2 minutes.
17. No env validation or connectivity check script. No E2E smoke flows.
18. CI has no bundle-export smoke test, no Dependabot, and no EAS Workflows examples.
19. README has no screenshots or badges, and there's no architecture/customization
    guide, SECURITY.md, CHANGELOG, or release checklist.

## 4. Implementation plan (Sonnet 5 subagents)

Each agent works in an isolated git worktree. Package manifests are touched **only
in Wave 1**, so the later waves never conflict on `package-lock.json`. Every agent
must leave `npm run typecheck && npm run lint && npm test` green and add tests for
new logic.

### Wave 1: Foundation (1 agent, sequential)
- **A. Platform & dependencies:** remove unused deps, plugins, the `AD_ID`
  permission, and dead code; add `expo-updates` (fingerprint runtime, URL from
  `EAS_PROJECT_ID`), `expo-haptics`, `expo-network`, and `@sentry/react-native`
  (plugin + init only when `EXPO_PUBLIC_SENTRY_DSN` is set); `src/lib/monitoring.ts`;
  React Query focus/online managers; `src/shopify/locale.ts` (country/language from
  `expo-localization` with env overrides) and locale-aware `formatMoney`;
  `ITSAppUsesNonExemptEncryption: false`.

### Wave 2: Features (3 agents, parallel)
- **B. Checkout & accounts** (`src/shopify/{auth,cart,cart-operations,checkout,customer*}`,
  cart + account screens):
  - `customerAccessToken` buyer identity.
  - Guest-cart rebuild on sign-out.
  - Shopify logout call.
  - Discount codes (apply/remove) with allocations shown.
  - Cart warnings.
  - Remove `totalTaxAmount`.
  - `@inContext` + `countryCode` on cart operations.
  - Analytics identify by GID.
  - Opt-in accelerated checkout (iOS), exposed as a reusable component.
- **C. Catalog & discovery** (catalog queries/hooks, home, shop, search, collection,
  PDP, product card):
  - `@inContext` on catalog queries.
  - Product recommendations rail.
  - Prefetch + placeholder PDP.
  - Share, haptics, gallery indicator, "View cart" after adding.
  - Local wishlist with a Saved screen.
  - Recent searches.
- **D. Demo mode & DX:**
  - mock.shop demo transport when unconfigured, with a demo banner.
  - `npm run check:env` (validates `.env`, pings the Storefront API, prints the
    callback URI).
  - Maestro smoke flows.

### Wave 3: Launch (2 agents, parallel)
- **E. Docs:** README overhaul, `docs/architecture.md`, `docs/customization.md`,
  SECURITY.md, CHANGELOG.md, CONTRIBUTING/AGENTS updates, consolidated
  `.env.example`, and a roadmap.
- **F. CI/CD:** export smoke jobs (iOS + Android), Dependabot (Expo packages
  grouped/ignored), EAS Workflows examples, and `docs/release-checklist.md` (store
  listing, privacy labels, screenshots).

### Integration (orchestrator)
Merge each wave, resolve conflicts, run the full checks plus
`npx expo export --platform ios|android`, then do a review pass, commit, and push.

## 5. Explicitly deferred (roadmap)
- Checkout Kit v4 (`@shopify/checkout-kit`): adopt when it leaves alpha.
- `NativeTabs` / Liquid Glass tab bar: adopt when stable (SDK 58).
- GraphQL codegen (`@shopify/api-codegen-preset`) to replace hand-written types.
- `selectedOrFirstAvailableVariant` / `encodedVariantAvailability` for
  very-high-variant products, instead of loading every variant page.
- Metaobject-driven Home sections, so merchants can edit without a rebuild.
- i18n string catalog. FlashList for very large catalogs.
- Agentic commerce (UCP / Storefront MCP) sample integration.

## 6. Needs the maintainer (can't be done by agents)
- Real-device QA on a live store (see `docs/manual-qa.md`).
- Screenshots and a demo GIF in `docs/media/`.
- Requesting `write_cart_wallet_payments` and an Apple merchant id to demo
  accelerated checkouts.
- Setting the GitHub repo to public, adding topics, and marking it as a template repository.

## 7. Status

Shipped, by wave (see `git log` for the full commit-level detail; a
human-readable summary is in `CHANGELOG.md`'s `[Unreleased]` section):

- **Wave 1 (Platform & dependencies):** unused deps/plugins/`AD_ID` permission
  and dead code removed; `expo-updates` (fingerprint runtime), `expo-haptics`,
  `expo-network`, and optional `@sentry/react-native` added; React Query
  focus/online managers wired up; `src/shopify/locale.ts` + locale-aware
  `formatMoney`; `ITSAppUsesNonExemptEncryption: false`.
- **Wave 2 (Features, 3 agents in parallel):**
  - **Checkout & accounts:** authenticated checkout via
    `customerAccessToken` buyer identity, sign-out privacy (guest-cart
    rebuild + Shopify logout call), discount codes with allocations, cart
    `warnings` surfaced, deprecated `totalTaxAmount` removed, `@inContext` +
    `countryCode` on cart operations, GID-based analytics identity, opt-in
    accelerated checkout (iOS).
  - **Catalog & discovery:** `@inContext` on catalog queries, product
    recommendations rail, prefetch + placeholder PDP, share/haptics/gallery
    indicator/"View cart" affordance, local wishlist with a Saved screen,
    recent searches.
  - **Demo mode & DX:** mock.shop demo transport with a demo banner,
    `npm run check:env`, Maestro smoke flows.
- **Wave 3 (Launch, 2 agents in parallel):**
  - **Docs (this agent):** README overhaul, `docs/architecture.md`,
    `docs/customization.md`, `SECURITY.md`, `CHANGELOG.md`,
    `CONTRIBUTING.md`/`AGENTS.md` updates, `docs/manual-qa.md` additions,
    `docs/media/README.md`, issue templates, this status section.
  - **CI/CD:** export smoke jobs, Dependabot, EAS Workflows examples,
    `docs/release-checklist.md` — see that agent's own changes for scope and
    status; this document doesn't track them in detail.

Still open — the "Needs the maintainer" list in §6 above, unchanged by any
wave (none of it can be done from a sandboxed agent: it needs a live Shopify
store, real devices, Apple/Shopify merchant-side approvals, and GitHub repo
settings only an owner can change).
