import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import type { OrderSummary } from '@/shopify/customer';
import { formatOrderDate, getOrderStatusPresentation } from '@/shopify/order-presentation';
import { AppSurface } from './app-surface';
import { AppText } from './app-text';
import { Price } from './price';
import { StatusBadge } from './status-badge';

export type OrderCardProps = Omit<PressableProps, 'children'> & { order: OrderSummary };

export function OrderCard({
  order,
  accessibilityLabel: _accessibilityLabel,
  accessibilityRole: _accessibilityRole,
  ...props
}: OrderCardProps) {
  const status = getOrderStatusPresentation(order);
  const items = order.lineItems.edges.map((edge) => edge.node);
  const itemSummary = items.map((item) => `${item.quantity}× ${item.title}`).join(', ');
  const orderDate = formatOrderDate(order.processedAt);
  const accessibleLabel = [
    `Order ${order.name}`,
    formatMoney(order.totalPrice),
    orderDate,
    status.payment.label,
    status.fulfillment.label,
  ].join(', ');

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibleLabel}>
      <AppSurface variant="raised" style={styles.card}>
        <View style={styles.row}>
          <AppText variant="labelStrong">{order.name}</AppText>
          <Price amount={order.totalPrice.amount} currencyCode={order.totalPrice.currencyCode} />
        </View>
        <AppText variant="caption" tone="textSecondary">{orderDate}</AppText>
        <View style={styles.badges}>
          <StatusBadge {...status.payment} />
          <StatusBadge {...status.fulfillment} />
        </View>
        {itemSummary ? (
          <AppText variant="caption" tone="textSecondary" numberOfLines={2}>{itemSummary}</AppText>
        ) : null}
      </AppSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
});
