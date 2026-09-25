const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withUniwindConfig } = require('uniwind/metro');

// `getSentryExpoConfig` is Expo's `getDefaultConfig` plus Sentry's serializer
// (debug IDs for source maps). It's harmless when EXPO_PUBLIC_SENTRY_DSN is
// blank; the reanimated/uniwind wrappers compose on top as before.
const config = getSentryExpoConfig(__dirname);

module.exports = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind.d.ts',
});
