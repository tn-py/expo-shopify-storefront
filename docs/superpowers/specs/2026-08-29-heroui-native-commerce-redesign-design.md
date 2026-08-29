# HeroUI Native Commerce Redesign

## Intent

Turn the Expo Shopify starter into a neutral-premium, native-only iOS/Android commerce template. The finished app uses HeroUI Native through app-owned commerce components, system typography, configurable merchandising, and accessible shopper states. It preserves Expo Router, Shopify Checkout Sheet, `expo-image`, React Query, authentication, analytics, notifications, and deep links.

## Product Decisions

- Supported platforms are iOS and Android; Expo web support is removed.
- HeroUI Native and Uniwind provide the component/styling foundation, but route files consume semantic app-owned components rather than styling HeroUI directly.
- Brand accent values remain environment-driven and initialize both Uniwind themes; navigation and Shopify Checkout read the same values.
- Homepage merchandising is controlled by a typed local configuration with automatic Shopify collection fallbacks.
- The five tabs remain Home, Shop, Search, Cart, and Account.
- Scope includes essential UX and data corrections. Wishlist, reviews, loyalty, full native address CRUD, and unrelated commerce expansion are excluded.

## Experience Design

Home is a configurable merchandising canvas with announcement, brand/search header, hero, collection and product sections, and trust content. Shop is the complete collection directory. Search separates predictive suggestions from submitted results. Collection adds count, supported filters, sorting, adaptive layout, and robust pagination. Product adds a responsive gallery, valid variant selection, stock/savings, quantity, service disclosures, and recoverable add-to-cart feedback.

Cart uses accessible quantity controls, mutation recovery, undo, an estimated total, and guarded checkout. Account and post-purchase routes use consistent cards and status components, protect customer data at session boundaries, and present accurate fulfillment/tracking and guest/member copy. Every route has intentional loading, empty, offline/error, not-found, and pagination behavior.

## Architecture

The root mounts one `HeroUINativeProvider` inside the existing gesture root. `global.css` declares the HeroUI/Uniwind semantic palette. A theme initializer applies environment brand colors to light and dark themes and synchronizes forced/system scheme behavior. Native lists, images, navigation, and Shopify checkout remain outside HeroUI.

The shared layer exposes `AppText`, `AppButton`, `AppSurface`, `AppSearchField`, `StateView`, `StickyActionBar`, `AppToast`, `RemoteImage`, `CollectionCard`, `ProductCard`, `Price`, `StatusBadge`, `QuantityStepper`, `SelectableChip`, `CatalogGrid`, `AccountMenuRow`, and `OrderCard`. All controls meet 44-point targets and expose appropriate role, label, selected, disabled, and busy state.

## Data and Safety

- Variant selection always resolves to a real variant, disables impossible choices, and changes price/media/availability atomically.
- Cart mutations retain coherent previous state and show operation-specific recovery.
- Signed-in buyer identity is attached to checkout when supported.
- Customer query keys include session identity, protected routes are auth-gated, and customer query data is removed on sign-out.
- Search does not substitute predictive results for an authoritative empty submitted search.
- Pagination is gated against duplicate requests and preserves loaded content on page failures.

## Verification

Add Jest Expo and React Native Testing Library. Cover pure commerce logic, shared component behavior/accessibility, and each route's major shopper states. Each implementation slice ends with tests, typecheck, lint, Expo Doctor, and native export smoke checks. Manual QA covers iOS/Android, light/dark/system, dynamic type, VoiceOver/TalkBack, RTL, long content, offline behavior, deep links, auth cancellation, and Checkout Sheet recovery.
