import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSurface } from '@/components/ui/app-surface';
import { AppText } from '@/components/ui/app-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shown when the Storefront API env vars are missing — i.e. right after cloning
 * the template. Replaced by the real storefront as soon as `.env` is filled in.
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
            3. Restart the dev server
          </AppText>
          <AppText variant="code">npx expo start --dev-client --clear</AppText>
        </View>

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
