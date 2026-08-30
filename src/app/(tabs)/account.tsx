import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AccountMenuRow,
  AppButton,
  AppSurface,
  AppText,
  StateView,
  StatusBadge,
} from '@/components/ui';
import {
  configuredSupportEmail,
  safeExternalHttpUrl,
  supportMailtoUrl,
} from '@/config/account-links';
import { Spacing } from '@/constants/theme';
import {
  getPushPermission,
  isPushConfigured,
  requestPushPermission,
} from '@/notifications/onesignal';
import { useAuth } from '@/shopify/auth';
import { isCustomerAccountConfigured } from '@/shopify/env';
import { useShop } from '@/shopify/hooks';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const shop = useShop();
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const supportEmail = configuredSupportEmail();
  const supportUrl = supportMailtoUrl(supportEmail);
  const aboutUrl = safeExternalHttpUrl(process.env.EXPO_PUBLIC_ABOUT_URL?.trim());

  if (!auth.ready) return <StateView mode="loading" title="Loading account…" />;

  const signIn = async () => {
    setSigningIn(true);
    try {
      await auth.signIn();
    } catch (error) {
      Alert.alert('Sign in', (error as Error).message);
    } finally {
      setSigningIn(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Your customer data will be removed from this device. Your shopping cart stays available.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            setSigningOut(true);
            void auth.signOut().catch((error) => {
              Alert.alert('Couldn’t sign out', (error as Error).message);
              setSigningOut(false);
            });
          },
        },
      ],
    );
  };

  const name = [auth.customer?.firstName, auth.customer?.lastName].filter(Boolean).join(' ');

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <AppText variant="title">Account</AppText>

        {auth.isAuthenticated ? (
          <AppSurface variant="raised" style={styles.identity}>
            <View style={styles.identityHeader}>
              <AppText variant="heading">{name || 'Your account'}</AppText>
              <StatusBadge label="Signed in" tone="success" />
            </View>
            {auth.customer?.emailAddress ? (
              <AppText tone="textSecondary">{auth.customer.emailAddress}</AppText>
            ) : null}
            {auth.customerProfileStatus === 'loading' ? (
              <AppText variant="caption" tone="textSecondary">Refreshing profile…</AppText>
            ) : null}
            {auth.customerProfileStatus === 'error' ? (
              <View style={styles.profileError}>
                <AppText tone="sale">{auth.customerProfileError}</AppText>
                <AppButton
                  label="Retry customer profile"
                  variant="secondary"
                  onPress={() => void auth.retryCustomerProfile().catch(() => undefined)}
                />
              </View>
            ) : null}
          </AppSurface>
        ) : isCustomerAccountConfigured ? (
          <AppSurface variant="muted" style={styles.identity}>
            <AppText variant="heading">Sign in for order details</AppText>
            <AppText tone="textSecondary">
              View orders, track shipments, and see saved addresses tied to your Shopify account.
            </AppText>
            <AppButton label="Sign in" loading={signingIn} onPress={() => void signIn()} />
          </AppSurface>
        ) : (
          <AppSurface variant="muted" style={styles.identity}>
            <AppText variant="heading">Customer accounts are optional</AppText>
            <AppText tone="textSecondary">
              Add the Customer Account API settings to enable sign-in, orders, and addresses.
            </AppText>
          </AppSurface>
        )}

        {auth.isAuthenticated ? (
          <AppSurface variant="raised" style={styles.menu}>
            <Link href="/account/orders" asChild>
              <AccountMenuRow label="Orders" detail="History, shipments, tracking, and totals" />
            </Link>
            <Link href="/account/addresses" asChild>
              <AccountMenuRow label="Addresses" detail="View saved shipping addresses" />
            </Link>
          </AppSurface>
        ) : null}

        {(isPushConfigured || supportUrl || aboutUrl) ? (
          <AppSurface variant="raised" style={styles.menu}>
            {isPushConfigured ? <NotificationsRow /> : null}
            {supportEmail && supportUrl ? (
              <AccountMenuRow
                label="Contact support"
                detail={supportEmail}
                onPress={() => void Linking.openURL(supportUrl)}
              />
            ) : null}
            {aboutUrl ? (
              <AccountMenuRow
                label={shop.data?.name ? `About ${shop.data.name}` : 'About'}
                onPress={() => void Linking.openURL(aboutUrl)}
              />
            ) : null}
          </AppSurface>
        ) : null}

        {auth.isAuthenticated ? (
          <AppButton
            label="Sign out"
            variant="danger"
            loading={signingOut}
            onPress={confirmSignOut}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function NotificationsRow() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void getPushPermission().then((value) => {
      if (active) setGranted(value);
    });
    return () => { active = false; };
  }, []);

  const enable = async () => {
    const allowed = await requestPushPermission();
    setGranted(allowed);
    if (!allowed) {
      Alert.alert(
        'Notifications are off',
        'Open this app in device Settings to enable order updates.',
      );
    }
  };

  return (
    <AccountMenuRow
      label="Order notifications"
      detail={granted === null ? 'Checking permission…' : granted ? 'Enabled' : 'Disabled'}
      disabled={granted === true}
      onPress={() => void enable()}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  identity: { padding: Spacing.three, gap: Spacing.two },
  identityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  profileError: { gap: Spacing.two },
  menu: { paddingHorizontal: Spacing.three, overflow: 'hidden' },
});
