const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
// `getSentryExpoConfig` replaces the `getDefaultConfig` call outright, which
// doesn't compose with the reanimated/uniwind wrapper chain below. `withSentryConfig`
// is the composable equivalent (debug IDs + source-map metadata); it's a no-op
// at runtime when EXPO_PUBLIC_SENTRY_DSN is blank.
const { withSentryConfig } = require('@sentry/react-native/metro');

const config = getDefaultConfig(__dirname);

module.exports = withSentryConfig(
  withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
    cssEntryFile: './global.css',
    dtsFile: './src/uniwind.d.ts',
  }),
);
