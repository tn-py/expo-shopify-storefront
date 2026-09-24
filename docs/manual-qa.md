# Native storefront manual QA

Run this checklist against a development or preview build on both iOS and
Android. Use a Shopify test store with at least two customers, multiple orders,
a partially fulfilled order, tracking data, more than 25 orders or addresses for
pagination, and Checkout test mode.

Record the device/OS, build commit, Shopify API version, theme, text-size setting,
and result beside every failed item. Attach a screenshot or screen recording and
the shortest reproduction path.

## Build smoke checks

- [ ] `npm test -- --runInBand` completes with zero failing suites.
- [ ] `npm run typecheck` and `npm run lint` complete with zero errors.
- [ ] `npm run doctor` reports no actionable dependency/configuration issues.
- [ ] `npm run check:env` against a filled `.env` reports no errors and successfully
      pings the Storefront API; against the untouched `.env.example` copy it reports
      the blank token as an error and exits non-zero.
- [ ] `npx expo export --platform ios --output-dir /tmp/uhs-export-ios` succeeds.
- [ ] `npx expo export --platform android --output-dir /tmp/uhs-export-android` succeeds.
- [ ] `npx expo export --platform android` succeeds with a blank
      `EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN` / `_STOREFRONT_TOKEN` (demo mode must bundle
      without throwing at import time).
- [ ] A fresh iOS install reaches Home, and a fresh Android install reaches Home.
- [ ] `.maestro/smoke-browse.yaml` and `.maestro/search.yaml` pass against a dev/preview
      build (`maestro test -e APP_ID=<bundle id> .maestro/` — see
      [e2e.md](./e2e.md)).

## Demo mode

Run with `.env` unfilled (or `cp .env.example .env`) — the default is demo mode on.

- [ ] With no store configured, Home/Shop/Search/Cart show mock.shop's sample catalog
      instead of the setup wall.
- [ ] The "Demo store · Connect yours" pill appears just above the tab bar, doesn't
      shift any screen's layout, and is reachable by screen reader as a labeled
      button.
- [ ] Tapping the pill opens `/setup` as a modal with the step-by-step connection
      guide; dismissing the pill hides it for the app session, and it's back after a
      fresh launch.
- [ ] Setting `EXPO_PUBLIC_DEMO_MODE=off` with nothing configured shows the setup
      wall instead (no pill, no catalog).
- [ ] Filling in a real store domain + token shows that store regardless of
      `EXPO_PUBLIC_DEMO_MODE`, with no demo pill.
- [ ] See [demo-mode.md](./demo-mode.md) for what's expected to differ (checkout,
      accounts) while in demo mode — don't file those as bugs.

## Visual and responsive coverage

Repeat the commerce journey Home → Shop → Collection → Product → Cart → Account
in light, dark, and system appearance on each platform.

- [ ] Backgrounds, text, dividers, badges, disabled states, and focus/pressed
      states remain legible in light and dark appearance.
- [ ] System appearance changes update the app without leaving mismatched screens,
      navigation chrome, status bar, or Checkout Sheet colors.
- [ ] Content clears notches, Dynamic Island/camera cutouts, status bars, home
      indicators, gesture bars, and the software keyboard.
- [ ] Phone portrait, phone landscape, and tablet/split-screen layouts avoid
      clipped cards, nested-scroll traps, excessive line lengths, and overlapping
      sticky actions.
- [ ] Remote images keep useful crops; missing images show stable accessible
      placeholders without collapsing rows.
- [ ] Very long product, collection, customer, address, variant, carrier, and order
      names wrap or truncate intentionally without covering prices/actions.
- [ ] Prices, dates, and formatted addresses remain readable under a non-US device
      locale.

## Commerce and recovery

- [ ] Predictive Search suggestions disappear after an authoritative submitted
      search returns no results.
- [ ] Collection/Search pagination does not duplicate requests; a failed next page
      preserves loaded products and its retry loads only the missing page.
- [ ] Product options always select a real variant; unavailable combinations cannot
      be selected; price, image, stock, and quantity total change together.
- [ ] Rapid cart quantity taps settle on the last selected quantity. Failed update,
      remove, undo, add, and refresh operations preserve a coherent cart and show
      the correct recovery action.
- [ ] Checkout cannot present twice. Canceling returns to the same cart. Simulated
      Checkout Sheet/network failure shows a retry path and does not clear the cart.
- [ ] A completed test checkout clears the cart and shows only the non-sensitive
      confirmation fields supplied by Shopify, with accurate guest/member actions.

## Account privacy and authentication

- [ ] With customer accounts unconfigured, Account explains setup and shows no
      broken Orders/Addresses controls.
- [ ] Canceling Shopify sign-in returns safely; a network/token/profile failure
      shows the existing retry action and does not claim the shopper is signed out.
- [ ] Opening `/account/orders`, `/account/addresses`, and a valid order deep link
      while signed out shows the sign-in gate and issues no Customer Account API
      request (confirm with a proxy or debug network log).
- [ ] Customer A's identity, orders, addresses, shipments, and errors appear only
      while signed in as customer A.
- [ ] Confirmed sign-out shows progress, cancels/removes protected queries, routes
      away from protected content, and leaves the public catalog/cart usable.
- [ ] After signing out A and signing in B, no A name, order, address, image,
      placeholder, pagination page, error, or stale deep-link detail appears.
- [ ] An expired refresh token removes protected data and returns to Account just
      like explicit sign-out.

## Orders and addresses

- [ ] Orders show locale dates, totals, distinct payment and fulfillment badges,
      and intentional pending, partial, fulfilled, cancelled, and refunded states.
- [ ] Order pagination preserves existing orders on failure, disables duplicate
      next-page calls, and recovers with “Retry loading more orders.”
- [ ] Order links containing a malformed escape, whitespace/control character,
      query, fragment, or suffix show recovery without issuing a Customer Account
      API request; another customer's valid order shows the not-found state.
- [ ] Order detail shows item images, variants/options, quantities, subtotal,
      shipping, tax, refunds when present, and total using Shopify-returned fields.
- [ ] Each fulfillment shows its shipment state, estimated date when present, and
      tracking company/number. Only valid HTTP(S) tracking URLs open.
- [ ] “Reorder available items” adds only line items with current variant IDs,
      opens Cart on success, and explains partial/no-add failure accurately.
- [ ] Configured support email opens a pre-addressed draft containing the order
      name; a missing, invalid, or CR/LF header-injecting value hides the action on
      both Account and Order detail.
- [ ] Addresses render Shopify's locale-formatted lines, default status, phone when
      present, empty state, and retryable pagination without exposing native CRUD.
- [ ] The configured “Manage addresses online” action opens the expected HTTPS
      customer-account page; an HTTP, missing, or invalid URL hides the action.

## Accessibility and content direction

- [ ] Every control is at least 44×44 points/dp and has a meaningful role, label,
      disabled/selected state, and busy state where applicable.
- [ ] VoiceOver on iOS and TalkBack on Android announce page headings, prices,
      payment/fulfillment badges, quantities, identity, menu rows, loading/error
      summaries, and actions in a useful order.
- [ ] Swipe navigation reaches each control once; decorative images/icons do not
      create noisy duplicate stops; modal alerts return focus predictably.
- [ ] At the largest supported Dynamic Type/font-size setting, content remains
      operable without horizontal scrolling, clipped labels, or hidden actions.
- [ ] With an RTL locale, navigation direction, rows, badges, text alignment, and
      back behavior are coherent; numbers, currency, order IDs, and tracking codes
      remain understandable.
- [ ] Reduce Motion does not make state changes ambiguous, and Increase Contrast /
      Android high-contrast text keeps status and action distinctions visible.

## Offline and link handling

- [ ] Launching offline gives intentional cached/loading/error states; reconnecting
      and pressing Retry restores each affected route without restarting the app.
- [ ] Product, collection, search, cart, orders, and order-detail custom/universal
      links open the intended route from cold start and background state.
- [ ] Off-site or malformed links never enter protected screens or crash the app.
- [ ] Push notification taps route correctly when signed in; protected notification
      links show the auth gate after sign-out rather than stale order data.
