import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.four,
          paddingTop: insets.top + Spacing.five,
          gap: Spacing.three,
        }}>
        <ThemedText type="title">Almost there</ThemedText>
        <ThemedText themeColor="textSecondary">
          This app needs your Shopify Storefront API credentials before it can
          load a catalog.
        </ThemedText>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <ThemedText type="smallBold">1. Create your env file</ThemedText>
          <ThemedText type="code">cp .env.example .env</ThemedText>
          <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
            2. Fill in at least
          </ThemedText>
          <ThemedText type="code">EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN</ThemedText>
          <ThemedText type="code">EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN</ThemedText>
          <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
            3. Restart the dev server
          </ThemedText>
          <ThemedText type="code">npx expo start --dev-client --clear</ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          See docs/shopify-setup.md for how to create the Storefront API access
          token and the required scopes.
        </ThemedText>
      </ScrollView>
    </ThemedView>
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
