import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SetupGuide } from '@/components/setup-required';
import { AppSurface } from '@/components/ui/app-surface';
import { AppText } from '@/components/ui/app-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isDemoStore, isStorefrontConfigured } from '@/shopify/env';

/**
 * Reachable from the demo-mode banner (and directly, at `/setup`). Walks
 * through connecting a real Shopify store; registered as a modal in the root
 * `_layout.tsx`.
 */
export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <AppSurface style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.five },
        ]}>
        {isDemoStore ? (
          <AppText tone="textSecondary">
            You’re browsing a demo store — sample products from Shopify’s public
            mock.shop, not a real store. Connect your own in a couple of
            minutes:
          </AppText>
        ) : isStorefrontConfigured ? (
          <AppText tone="textSecondary">
            A store is already configured. Use these steps if you want to point
            the app at a different one.
          </AppText>
        ) : (
          <AppText tone="textSecondary">
            Connect the app to your Shopify store in a couple of minutes:
          </AppText>
        )}

        <SetupGuide />

        <AppText variant="caption" tone="textSecondary">
          Full walkthrough — scopes, publishing products, checkout test mode —
          is in docs/shopify-setup.md.
        </AppText>
      </ScrollView>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
});
