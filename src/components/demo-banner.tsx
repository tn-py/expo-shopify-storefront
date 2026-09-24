import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSurface } from '@/components/ui/app-surface';
import { AppText } from '@/components/ui/app-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * React Navigation's default bottom-tab bar height (excludes the safe-area
 * inset, which is added separately below). Matches the unstyled `tabBarStyle`
 * used in `(tabs)/_layout.tsx`.
 */
const TAB_BAR_HEIGHT = 49;

/**
 * Small pill shown above the tab bar while the app is running in demo mode
 * (no store configured, browsing Shopify's mock.shop sample catalog).
 * Absolutely positioned so it never shifts screen content; dismissing it only
 * lasts for this session — it reappears on the next app launch as a reminder
 * that this isn't the shopper's own store.
 */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  if (dismissed) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: TAB_BAR_HEIGHT + insets.bottom + Spacing.two }]}>
      <AppSurface variant="raised" style={[styles.pill, { borderColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Demo store, browsing sample products. Tap to connect your own store."
          onPress={() => router.push('/setup')}
          style={({ pressed }) => [styles.tapArea, pressed && styles.pressed]}>
          <AppText variant="labelStrong">Demo store · Connect yours</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss demo store banner"
          hitSlop={8}
          onPress={() => setDismissed(true)}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
          <AppText tone="textSecondary" variant="labelStrong">
            ×
          </AppText>
        </Pressable>
      </AppSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
  },
  tapArea: { minHeight: 44, justifyContent: 'center', paddingVertical: Spacing.one },
  dismiss: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
});
