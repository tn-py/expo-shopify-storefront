# End-to-end smoke tests (Maestro)

[Maestro](https://maestro.mobile.dev) drives the real app on a simulator/emulator or
device through its accessible UI — the same labels VoiceOver/TalkBack would announce.
The flows in [`.maestro/`](../.maestro) cover the core commerce path and are designed
to run against **demo mode** (Shopify's public mock.shop sample catalog, see
[demo-mode.md](./demo-mode.md)) with zero setup, so anyone cloning the template can
run them immediately.

## 1. Install Maestro

```sh
curl -Ls "https://get.maestro.mobile.dev" | bash
```

See [Maestro's install docs](https://docs.maestro.dev/getting-started/installing-maestro)
for other platforms/methods. Verify with `maestro --version`.

## 2. Build a dev or preview client

The Checkout Sheet Kit is a native module, so **Expo Go doesn't work** — Maestro needs
a real dev or preview build installed on the simulator/emulator or device:

```sh
eas build --profile development --platform android    # sideloadable APK
# or
eas build --profile preview --platform android         # closer to a store build
```

(Swap `android` for `ios` — Maestro supports both. An iOS simulator build works too:
`eas build --profile development-simulator --platform ios`.)

Install the resulting build on your simulator/emulator/device, then either run
`npm start` and connect (development profile) or just launch the installed app
(preview profile — no Metro connection needed).

## 3. Run the flows

```sh
maestro test -e APP_ID=<your bundle id> .maestro/
```

`APP_ID` is your app's bundle id / Android package name — `EXPO_PUBLIC_APP_BUNDLE_ID`
in `.env` (defaults to `com.example.storefront`). `npm run e2e` runs the same command,
reading `APP_ID` from your shell environment (falls back to the template default).

To run a single flow: `maestro test -e APP_ID=<your bundle id> .maestro/smoke-browse.yaml`.

## What's covered

- **`smoke-browse.yaml`** — launch → Home is visible → Shop tab → open the first
  collection → open the first product → Add to cart → Cart tab → the checkout button
  is present.
- **`search.yaml`** — Search tab → type a query (`snow` by default, matching
  mock.shop's snowboard-themed sample catalog) → submit → the first result opens a
  product detail page. Override the query for a different catalog:
  `maestro test -e APP_ID=<your bundle id> -e SEARCH_QUERY=<term> .maestro/search.yaml`.

## Notes

- These flows never assert on specific product/collection **names**, since demo mode
  (and any real store) serves different catalog content — they always act on "the
  first item below this heading" instead. If your catalog's layout differs
  significantly (e.g. a collection or search result page with no items), adjust the
  `below:` anchor text or the search query.
- Running against your own configured store works the same way — nothing here is
  demo-mode-specific except the default search query.
- Not run in CI: these need a booted simulator/emulator or connected device.
