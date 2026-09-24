# Security policy

## Supported versions

This is a template repository, not a versioned library — there's one
supported line: **`main`**, tracking the latest Expo SDK release this
template targets (currently **Expo SDK 57**). Security fixes land there only;
older commits or forks you've already generated a store app from are your own
responsibility to patch by merging upstream changes.

## Reporting a vulnerability

Please report security issues **privately**, not as a public GitHub issue —
use [GitHub's private vulnerability reporting](https://github.com/tn-py/expo-shopify-storefront/security/advisories/new)
(Security tab → **Report a vulnerability**) on this repository. That opens a
private advisory only maintainers and you can see, and lets us coordinate a
fix before any public disclosure.

Include, where relevant: the affected file(s), Expo SDK version, platform
(iOS/Android), whether it reproduces in demo mode or only against a
configured store, and the minimal steps to reproduce.

We'll acknowledge new reports as quickly as we can and keep you updated as a
fix is prepared. There's no bug-bounty program — this is a community
template.

## Scope notes

A few things that look sensitive but are **not** vulnerabilities in this
template's design:

- **The Storefront API access token and Customer Account API client id are
  public, client-side credentials by design.** `EXPO_PUBLIC_*` values are
  inlined into the JS bundle and visible to anyone who inspects the shipped
  app — that's how Shopify's Storefront API and Customer Account API mobile
  public clients work. Don't file "the token is visible in the app" as a
  vulnerability; instead make sure the Storefront token only has the
  `unauthenticated_read_*` / `unauthenticated_write_checkouts` scopes it
  actually needs (see [docs/shopify-setup.md](docs/shopify-setup.md)).
- **Customer Account API tokens** (access/refresh/id) are a different story —
  those are per-user secrets and are stored in `expo-secure-store` (the
  platform keychain/keystore), never `AsyncStorage` or logs. A real finding
  here (e.g. a token leaking into analytics, a log, or `AsyncStorage`) *is*
  in scope.

## Things that must never be committed

- **`.env`** — gitignored; only `.env.example` (with blank secrets) is
  tracked. If you accidentally commit a real store's `.env`, rotate the
  Storefront API token and any Customer Account API credentials immediately.
- **`SENTRY_AUTH_TOKEN`** — used only for source-map upload at build time; set
  it as an EAS secret (`eas secret:create --name SENTRY_AUTH_TOKEN`), never in
  `.env` or `.env.example`.
- **Signing keys and credentials** — Android keystores, iOS provisioning
  profiles/certificates, and Apple/Google service-account JSON (e.g. the
  Firebase service-account key used for OneSignal's FCM setup) are managed
  through `eas credentials` / EAS secrets, not committed to the repository.
- **OneSignal's REST API key** — server-side only; it's never referenced by
  the app or `.env` (only the public App ID is).
