# Deep links & universal links

## What works with no hosting

The custom scheme resolves immediately (scheme = `EXPO_PUBLIC_APP_SCHEME`, default
`shopstore`):

- `shopstore://product/<handle>`
- `shopstore://collection/<handle>`
- `shopstore://cart`, `shopstore://search`, `shopstore://account/orders`

`src/app/+native-intent.ts` also rewrites **storefront-shaped** paths, so a link to
`https://<your-domain>/products/<handle>` lands on the in-app product screen
(Shopify uses the plural `/products/`, the app route is singular `/product/`).
Collections and `/search` are handled the same way.

## Making `https://` links open the app silently

Set `EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS` to your comma-separated host(s), e.g.
`shop.example.com,www.example.com`, and rebuild. `app.config.ts` then emits the
iOS `associatedDomains` and Android App Links `intentFilters` automatically.

You also have to serve two files from each domain over HTTPS, `Content-Type:
application/json`, with **no redirects**:

| File in this repo | Must be served at |
| --- | --- |
| `docs/well-known/apple-app-site-association.json` | `https://<host>/.well-known/apple-app-site-association` (no `.json` extension) |
| `docs/well-known/assetlinks.json` | `https://<host>/.well-known/assetlinks.json` |

### Fill in the placeholders

- **`<APP_BUNDLE_ID>`** — the value of `EXPO_PUBLIC_APP_BUNDLE_ID`
  (e.g. `com.example.storefront`).
- **`<ANDROID_SIGNING_SHA256>`** — run `eas credentials` → *Android* → *development*
  (and later *production*) → *Keystore* → copy the **SHA-256 Fingerprint**
  (colon-separated hex). Include every signing key you ship with, including Google
  Play App Signing if enabled.
- **`<APPLE_TEAM_ID>`** — Apple Developer account → Membership. Requires a paid
  Apple Developer Program membership; until then iOS universal links can't be
  verified (the custom scheme still works).

### Hosting when the storefront is on Shopify

Shopify doesn't serve arbitrary `/.well-known/` files from a theme. Options:

1. A reverse proxy / edge rule in front of the domain (Cloudflare Worker,
   Netlify/Vercel redirect, etc.) that returns these two files.
2. A Shopify app that adds the routes (an "app links" / "deep links" app).
3. Shopify Plus: serve them from the checkout/CDN edge.

### Verify

```sh
curl -I https://<host>/.well-known/assetlinks.json
curl -s https://<host>/.well-known/apple-app-site-association | jq .

# Android, on a connected device:
adb shell pm verify-app-links --re-verify <APP_BUNDLE_ID>
adb shell pm get-app-links <APP_BUNDLE_ID>   # want: verified
```
