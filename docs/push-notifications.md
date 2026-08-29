# Push notifications (OneSignal)

Push is **optional** and off until `EXPO_PUBLIC_ONESIGNAL_APP_ID` is set — the
app builds and runs fine without it. When configured, the app registers the
device with [OneSignal](https://onesignal.com), links signed-in shoppers to their
Shopify customer id, and routes notification taps to the right screen.

OneSignal ships native code, so it only works in a **dev client or release
build** — not Expo Go — and needs a rebuild after you set the env vars.

Budget ~20 minutes (most of it is APNs / FCM credentials).

## 1. Create the OneSignal app

1. [onesignal.com](https://onesignal.com) → **New App/Website**. Name it after
   your store.
2. Add the **Apple iOS (APNs)** platform: upload an APNs **`.p8` auth key**
   (Apple Developer → Keys) with its Key ID and your Team ID. A token key works
   for both sandbox and production.
3. Add the **Google Android (FCM)** platform: in the Firebase console create (or
   reuse) a project, then **Project settings → Service accounts → Generate new
   private key**, and upload that JSON to OneSignal.
4. **Settings → Keys & IDs**: copy the **OneSignal App ID**, and note the
   **REST API Key** (server-side only — never put it in the app or `.env`).

## 2. Configure the template

```sh
# .env
EXPO_PUBLIC_ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EXPO_PUBLIC_ONESIGNAL_IOS_MODE=development   # or: production
```

`EXPO_PUBLIC_ONESIGNAL_IOS_MODE` sets the iOS APNs environment baked into the
build — `development` for dev-client and simulator builds, `production` for
TestFlight and the App Store. Android ignores it.

`app.config.ts` adds `onesignal-expo-plugin` to the config only when the App ID
is present, so rebuild the dev client:

```sh
eas build --profile development --platform all
```

## 3. Ask for permission

`src/notifications/onesignal.tsx` never prompts on its own. The **Account** tab
shows a "Push notifications" row (only when push is configured) that calls
`requestPushPermission()` — which also covers Android 13+'s `POST_NOTIFICATIONS`.
Call `requestPushPermission()` from anywhere else you want a prompt (e.g. after
the first order).

## 4. How identity works

| Event | What the app calls | Effect in OneSignal |
| --- | --- | --- |
| Customer signs in | `OneSignal.login(<shopify customer id>)` + `addEmail` | Device aliased to `external_id` + email |
| Customer signs out | `OneSignal.logout()` | Device unlinked |

Wired in `src/shopify/auth.tsx` next to the analytics `identify` call. The
external id is the Shopify customer GID (falls back to email if the id isn't
available). From your backend you can then target a shopper with:

```jsonc
// POST https://api.onesignal.com/notifications
{
  "app_id": "…",
  "target_channel": "push",
  "include_aliases": { "external_id": ["gid://shopify/Customer/1234567890"] },
  "headings": { "en": "Your order shipped" },
  "contents": { "en": "Track it in the app." },
  "url": "shopstore://account/orders"
}
```

Use `setPushTags({ … })` from `src/notifications/onesignal.tsx` to add segmentation
tags (e.g. `last_order_at`, `vip`).

## 5. Deep-linking a notification

The tap handler (`PushProvider` in `src/notifications/onesignal.tsx`) looks for a
target URL in this order:

1. a custom data pair `url` on the notification,
2. the notification's **Launch URL**.

It runs the value through `src/lib/deep-link.ts` — the same normaliser
`+native-intent.ts` uses — so any of these land on the right screen:

- `shopstore://product/<handle>` (your `EXPO_PUBLIC_APP_SCHEME`)
- `https://<your-store-host>/products/<handle>` — only when the host is in
  `EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS`; storefront plural paths
  (`/products/…`, `/collections/…`, `/search`) are rewritten to app routes
- `shopstore://cart`, `shopstore://account/orders`, …

Off-site `https://` URLs are left to the OS (they open in the browser).

## 6. Send a test

- **Dashboard:** OneSignal → **Messages → New Push**, send to *Subscribed Users*,
  optionally set a Launch URL like `shopstore://cart`.
- **API:** `curl` the payload above with header
  `Authorization: Key <REST_API_KEY>`.

On the Bogus Gateway / a dev build you still get real pushes — only checkout
payments are faked.

## Notes

- `expo-notifications` stays in the plugin list **only** for the Android
  notification icon tint (`EXPO_PUBLIC_BRAND_PRIMARY`). OneSignal owns delivery
  and the push token — don't call `expo-notifications`' token APIs alongside it.
- No App ID → every export in `src/notifications/onesignal.tsx` is a no-op and the
  Account row is hidden. Nothing else changes.
- iOS simulators can receive pushes on recent Xcode, but a physical device is the
  reliable test.
