import * as Linking from 'expo-linking';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppSurface } from '@/components/ui/app-surface';
import { AppText } from '@/components/ui/app-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The template's own upstream repo — not store configuration, so hard-coding
 * it here is fine (see AGENTS.md). Links to the setup guide for whoever is
 * evaluating a clone that isn't wired up to their own store yet.
 */
const SETUP_DOCS_URL =
  'https://github.com/tn-py/expo-shopify-storefront/blob/main/docs/shopify-setup.md';

/**
 * The step-by-step guide shared by the full-screen `SetupRequired` wall (no
 * store configured, demo mode off) and the `/setup` modal (reachable from the
 * demo-mode banner, or anyone who wants the steps again).
 */
export function SetupGuide() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <AppText variant="captionStrong">1. Create your env file</AppText>
      <AppText variant="code">cp .env.example .env</AppText>

      <AppText variant="captionStrong" style={{ marginTop: Spacing.two }}>
        2. Fill in at least
      </AppText>
      <AppText variant="code">EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN</AppText>
      <AppText variant="code">EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN</AppText>

      <AppText variant="captionStrong" style={{ marginTop: Spacing.two }}>
        3. Check it
      </AppText>
      <AppText variant="code">npm run check:env</AppText>
      <AppText tone="textSecondary" variant="caption">
        Validates your `.env` and pings the Storefront API with your token.
      </AppText>

      <AppText variant="captionStrong" style={{ marginTop: Spacing.two }}>
        4. Restart the dev server
      </AppText>
      <AppText variant="code">npx expo start --dev-client --clear</AppText>
      <AppText tone="textSecondary" variant="caption">
        `--clear` matters — Metro caches inlined `EXPO_PUBLIC_*` values.
      </AppText>

      <AppButton
        label="Open the full setup guide"
        variant="secondary"
        style={{ marginTop: Spacing.three }}
        onPress={() => void Linking.openURL(SETUP_DOCS_URL)}
      />
    </View>
  );
}

/**
 * Shown when the Storefront API env vars are missing and demo mode is off
 * (`EXPO_PUBLIC_DEMO_MODE=off`) — i.e. someone opted out of the mock.shop
 * fallback and hasn't configured a store yet. Replaced by the real storefront
 * (or the demo store) as soon as `.env` is filled in.
 */
export function SetupRequired() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <AppSurface style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.four,
          paddingTop: insets.top + Spacing.five,
          gap: Spacing.three,
        }}>
        <AppText variant="title">Almost there</AppText>
        <AppText tone="textSecondary">
          This app needs your Shopify Storefront API credentials before it can
          load a catalog.
        </AppText>

        <SetupGuide />

        <AppText variant="caption" tone="textSecondary">
          See docs/shopify-setup.md for how to create the Storefront API access
          token and the required scopes.
        </AppText>
      </ScrollView>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
