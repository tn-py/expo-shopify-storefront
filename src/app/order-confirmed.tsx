import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppSurface, AppText, StatusBadge } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/shopify/auth';
import type { ConfirmationParams } from '@/shopify/checkout';

function orderLabel(params: ConfirmationParams): string | null {
  if (params.orderName) return params.orderName;
  const identifier = params.orderId?.split('/').filter(Boolean).at(-1);
  return identifier ? `Order ${identifier}` : null;
}

export default function OrderConfirmedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    orderId?: string;
    orderName?: string;
    displayTotal?: string;
    customerEmail?: string;
  }>();
  const { isAuthenticated } = useAuth();
  const label = orderLabel(params);

  return (
    <AppSurface style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four },
        ]}>
        <View
          accessibilityRole="summary"
          accessibilityLabel="Order confirmed"
          style={styles.success}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.check}>
            <AppText style={styles.checkText}>✓</AppText>
          </View>
          <StatusBadge label="Order confirmed" tone="success" />
          <AppText variant="title" style={styles.center}>Thank you for your order</AppText>
          <AppText tone="textSecondary" style={styles.center}>
            Shopify has received your order and will send updates as it moves through fulfillment.
          </AppText>
        </View>

        {label || params.displayTotal ? (
          <AppSurface variant="muted" style={styles.details}>
            <AppText variant="heading">Order details</AppText>
            {label ? <DetailRow label="Order" value={label} /> : null}
            {params.displayTotal ? <DetailRow label="Total paid" value={params.displayTotal} /> : null}
          </AppSurface>
        ) : null}

        <AppSurface variant="raised" style={styles.nextSteps}>
          <AppText variant="heading">What happens next</AppText>
          {params.customerEmail ? (
            <AppText tone="textSecondary">
              We sent the confirmation and future order updates to {params.customerEmail}.
            </AppText>
          ) : (
            <AppText tone="textSecondary">
              Check the email address used during Shopify Checkout for confirmation and updates.
            </AppText>
          )}
          {isAuthenticated ? (
            <AppText tone="textSecondary">
              You can also review orders associated with your signed-in customer account.
            </AppText>
          ) : (
            <AppText tone="textSecondary">
              Keep the confirmation email for order updates and support. Guest orders may not appear in an account later.
            </AppText>
          )}
        </AppSurface>

        <View style={styles.support}>
          <AppText variant="labelStrong">Need help?</AppText>
          <AppText tone="textSecondary">
            Contact store support and include the order identifier shown above, when available.
          </AppText>
        </View>

        <View style={styles.actions}>
          {isAuthenticated ? (
            <AppButton
              label="View your orders"
              variant="secondary"
              onPress={() => router.push('/account/orders')}
            />
          ) : null}
          <AppButton label="Continue shopping" onPress={() => router.replace('/')} />
        </View>
      </ScrollView>
    </AppSurface>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText tone="textSecondary">{label}</AppText>
      <AppText variant="labelStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 0 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  success: { alignItems: 'center', gap: Spacing.three },
  check: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dcfce7' },
  checkText: { color: '#16803c', fontSize: 40, lineHeight: 48 },
  center: { textAlign: 'center' },
  details: { gap: Spacing.three, padding: Spacing.three },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  nextSteps: { gap: Spacing.two, padding: Spacing.three },
  support: { gap: Spacing.one },
  actions: { gap: Spacing.two },
});
