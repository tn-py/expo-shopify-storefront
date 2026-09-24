import type { ExpoConfig } from 'expo/config';

/**
 * Single source of truth for the native app config. Everything store-specific is
 * read from environment variables (see `.env.example`) so the template runs with
 * zero edits — just fill in `.env`.
 *
 * `EXPO_PUBLIC_*` vars are also inlined into the JS bundle at build time; the
 * plain `EAS_*` vars are only read here, during config evaluation.
 */

const env = process.env;

/** First non-empty, trimmed value — otherwise the fallback. */
const pick = (value: string | undefined, fallback: string): string =>
  value && value.trim() ? value.trim() : fallback;

const APP_NAME = pick(env.EXPO_PUBLIC_APP_NAME, 'Shopify Storefront');
const APP_SLUG = pick(env.EXPO_PUBLIC_APP_SLUG, 'expo-shopify-storefront');
const APP_SCHEME = pick(env.EXPO_PUBLIC_APP_SCHEME, 'shopstore');
const BUNDLE_ID = pick(env.EXPO_PUBLIC_APP_BUNDLE_ID, 'com.example.storefront');
const APP_BACKGROUND = pick(env.EXPO_PUBLIC_APP_BACKGROUND, '#ffffff');
const COLOR_SCHEME = pick(env.EXPO_PUBLIC_APP_COLOR_SCHEME, 'system');

const userInterfaceStyle =
  COLOR_SCHEME === 'light' || COLOR_SCHEME === 'dark' ? COLOR_SCHEME : 'automatic';

/**
 * Comma-separated hosts for universal / app links,
 * e.g. `EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS="shop.example.com,www.example.com"`.
 * When unset, the associated-domains / intent-filter blocks are omitted entirely.
 */
const linkDomains = (env.EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

/**
 * Shopify's Customer Account API requires a second URL scheme of the form
 * `shop.<shop-id>.*` for mobile public clients. Derive `<shop-id>` from the
 * Customer Account API URL so it follows the store automatically.
 */
const shopId = (env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL ?? '').match(
  /authentication\/(\d+)/,
)?.[1];

const schemes = [APP_SCHEME];
if (shopId) schemes.push(`shop.${shopId}.app`);

/**
 * Push notifications via OneSignal — only wired into the native build when
 * `EXPO_PUBLIC_ONESIGNAL_APP_ID` is set (see docs/push-notifications.md).
 * `mode` selects the iOS APNs environment: `development` for dev-client /
 * simulator builds, `production` for TestFlight / App Store.
 */
const onesignalAppId = pick(env.EXPO_PUBLIC_ONESIGNAL_APP_ID, '');
const onesignalMode =
  pick(env.EXPO_PUBLIC_ONESIGNAL_IOS_MODE, 'development') === 'production'
    ? 'production'
    : 'development';
const onesignalPlugin: NonNullable<ExpoConfig['plugins']> = onesignalAppId
  ? [['onesignal-expo-plugin', { mode: onesignalMode }]]
  : [];

/**
 * Crash reporting via Sentry — only wired into the native build when
 * `EXPO_PUBLIC_SENTRY_DSN` is set (see `src/lib/monitoring.ts`). `SENTRY_ORG` /
 * `SENTRY_PROJECT` are optional and only needed for source-map upload.
 */
const sentryDsn = pick(env.EXPO_PUBLIC_SENTRY_DSN, '');
const sentryOrg = pick(env.SENTRY_ORG, '');
const sentryProject = pick(env.SENTRY_PROJECT, '');
const sentryPlugin: NonNullable<ExpoConfig['plugins']> = sentryDsn
  ? [
      [
        '@sentry/react-native/expo',
        {
          ...(sentryOrg ? { organization: sentryOrg } : {}),
          ...(sentryProject ? { project: sentryProject } : {}),
        },
      ],
    ]
  : [];

export default (): ExpoConfig => ({
  name: APP_NAME,
  slug: APP_SLUG,
  version: '1.0.0',
  orientation: 'portrait',
  platforms: ['ios', 'android'],
  icon: './assets/images/icon.png',
  scheme: schemes,
  userInterfaceStyle,
  backgroundColor: APP_BACKGROUND,
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    // The app only ever talks HTTPS (Storefront/Customer Account APIs, Checkout
    // Sheet Kit) — no proprietary encryption, so skip the export-compliance
    // prompt on every App Store Connect upload.
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
    ...(linkDomains.length
      ? { associatedDomains: linkDomains.map((d) => `applinks:${d}`) }
      : {}),
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: APP_BACKGROUND,
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(linkDomains.length
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              data: linkDomains.map((host) => ({ scheme: 'https', host })),
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }
      : {}),
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: APP_BACKGROUND,
        image: './assets/images/splash-icon.png',
        imageWidth: 220,
      },
    ],
    'expo-secure-store',
    'expo-localization',
    ...onesignalPlugin,
    ...sentryPlugin,
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  // OTA updates identify compatible builds by native fingerprint rather than a
  // manually bumped `runtimeVersion` string. `updates.url` (and therefore the
  // whole OTA channel wiring) only applies once the project is linked to EAS.
  runtimeVersion: { policy: 'fingerprint' },
  ...(env.EAS_PROJECT_ID?.trim()
    ? { updates: { url: `https://u.expo.dev/${env.EAS_PROJECT_ID.trim()}` } }
    : {}),
  extra: {
    router: {},
    ...(env.EAS_PROJECT_ID?.trim()
      ? { eas: { projectId: env.EAS_PROJECT_ID.trim() } }
      : {}),
  },
  ...(env.EAS_OWNER?.trim() ? { owner: env.EAS_OWNER.trim() } : {}),
});
