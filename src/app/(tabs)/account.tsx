import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LoadingState } from '@/components/screen-state';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getPushPermission,
  isPushConfigured,
  requestPushPermission,
} from '@/notifications/onesignal';
import { useAuth } from '@/shopify/auth';
import { useShop } from '@/shopify/hooks';

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim();
const ABOUT_URL = process.env.EXPO_PUBLIC_ABOUT_URL?.trim();

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { ready, isAuthenticated, customer, signIn, signOut } = useAuth();
  const shop = useShop();
  const [busy, setBusy] = useState(false);

  if (!ready) return <LoadingState />;

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } catch (e) {
      Alert.alert('Sign in', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const greeting = customer?.firstName
    ? `Hi, ${customer.firstName}`
    : (customer?.emailAddress ?? 'Signed in');

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.three,
          paddingHorizontal: Spacing.three,
          paddingBottom: Spacing.six,
          gap: Spacing.three,
        }}>
        <ThemedText type="title">Account</ThemedText>

        {isAuthenticated ? (
          <>
            <ThemedText>{greeting}</ThemedText>
            <MenuLink href="/account/orders" label="Orders" hint="Order history & tracking" />
            <MenuLink
              href="/account/addresses"
              label="Addresses"
              hint="Saved shipping addresses"
            />
            <Pressable onPress={signOut} style={styles.link}>
              <ThemedText type="link">Sign out</ThemedText>
            </Pressable>
          </>
        ) : (
          <View style={{ gap: Spacing.three }}>
            <ThemedText type="small" themeColor="textSecondary">
              Sign in to see your orders, track shipments, and check out faster.
            </ThemedText>
            <Pressable
              onPress={handleSignIn}
              disabled={busy}
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}>
              <ThemedText style={styles.primaryText}>
                {busy ? 'Opening…' : 'Sign in'}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {(SUPPORT_EMAIL || ABOUT_URL || isPushConfigured) && (
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
        )}
        {isPushConfigured ? <NotificationsRow /> : null}
        {SUPPORT_EMAIL ? (
          <Pressable
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            style={styles.menuItem}>
            <ThemedText>Contact support</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {SUPPORT_EMAIL}
            </ThemedText>
          </Pressable>
        ) : null}
        {ABOUT_URL ? (
          <Pressable
            onPress={() => Linking.openURL(ABOUT_URL)}
            style={styles.menuItem}>
            <ThemedText>
              {shop.data?.name ? `About ${shop.data.name}` : 'About'}
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function NotificationsRow() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    getPushPermission().then((v) => {
      if (alive) setGranted(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const enable = async () => {
    const ok = await requestPushPermission();
    setGranted(ok);
    if (!ok) {
      Alert.alert(
        'Notifications',
        'Turn on notifications for this app in your device Settings to get order updates.',
      );
    }
  };

  return (
    <Pressable onPress={enable} disabled={granted === true} style={styles.menuItem}>
      <ThemedText>Push notifications</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {granted === true
          ? 'On — order updates and offers'
          : 'Tap to turn on order updates and offers'}
      </ThemedText>
    </Pressable>
  );
}

function MenuLink({ href, label, hint }: { href: string; label: string; hint?: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable style={styles.menuItem}>
        <ThemedText>{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  primaryBtn: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryText: { color: Brand.onPrimary, fontFamily: Fonts.bold, fontSize: 16 },
  menuItem: { paddingVertical: Spacing.two, gap: 2 },
  link: { paddingVertical: Spacing.two },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two },
});
