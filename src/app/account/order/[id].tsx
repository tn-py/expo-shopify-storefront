import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorState, LoadingState } from '@/components/screen-state';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/shopify/auth';
import { useOrder } from '@/shopify/customer';
import { humanize } from '../orders';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { getAccessToken } = useAuth();
  const { data: order, isPending, isError, error, refetch } = useOrder(
    getAccessToken,
    decodeURIComponent(id ?? ''),
  );

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  if (!order) return <ErrorState message="Order not found" />;

  const lines = order.lineItems.edges.map((e) => e.node);
  const addr = order.shippingAddress;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: order.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary">
          Placed {new Date(order.processedAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          {order.financialStatus ? `  ·  ${humanize(order.financialStatus)}` : ''}
        </ThemedText>

        <View style={[styles.section, { borderTopColor: theme.border }]}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Items
          </ThemedText>
          {lines.map((l, i) => (
            <View key={`${l.title}-${i}`} style={styles.lineRow}>
              <ThemedText type="small" style={styles.lineTitle} numberOfLines={2}>
                {l.quantity}× {l.title}
              </ThemedText>
              {l.totalPrice ? (
                <ThemedText type="small">{formatMoney(l.totalPrice)}</ThemedText>
              ) : null}
            </View>
          ))}
        </View>

        <View style={[styles.section, { borderTopColor: theme.border }]}>
          <View style={styles.lineRow}>
            <ThemedText type="smallBold">Total</ThemedText>
            <ThemedText type="smallBold">{formatMoney(order.totalPrice)}</ThemedText>
          </View>
        </View>

        {addr ? (
          <View style={[styles.section, { borderTopColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Shipping address
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[addr.firstName, addr.lastName].filter(Boolean).join(' ')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[addr.address1, addr.address2].filter(Boolean).join(', ')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[addr.city, addr.zoneCode, addr.zip].filter(Boolean).join(', ')}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.two },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  sectionTitle: { marginBottom: Spacing.one },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 2,
  },
  lineTitle: { flex: 1 },
});
