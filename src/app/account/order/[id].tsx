import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CustomerAuthGate, type AuthenticatedCustomerAccess } from '@/components/customer-auth-gate';
import {
  AppButton,
  AppSurface,
  AppText,
  RemoteImage,
  StateView,
  StatusBadge,
} from '@/components/ui';
import { configuredSupportEmail, supportMailtoUrl } from '@/config/account-links';
import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import { useCart } from '@/shopify/cart';
import { useOrder, type OrderDetail, type OrderFulfillment } from '@/shopify/customer';
import {
  formatOrderDate,
  getOrderStatusPresentation,
  humanizeStatus,
  reorderLinesForOrder,
  safeDecodeOrderId,
  safeTrackingUrl,
} from '@/shopify/order-presentation';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <CustomerAuthGate>
      {(access) => {
        const orderId = safeDecodeOrderId(id);
        return orderId
          ? <AuthenticatedOrder access={access} orderId={orderId} />
          : (
            <StateView
              mode="error"
              title="This order link isn’t valid"
              message="Return to your order history and choose the order again."
            />
          );
      }}
    </CustomerAuthGate>
  );
}

function AuthenticatedOrder({
  access,
  orderId,
}: {
  access: AuthenticatedCustomerAccess;
  orderId: string;
}) {
  const query = useOrder(access.getAccessToken, access.customerSessionKey, orderId);

  if (query.isPending) return <StateView mode="loading" title="Loading order…" />;
  if (query.isError) {
    return (
      <StateView
        mode="error"
        title="We couldn’t load this order"
        message={(query.error as Error).message}
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }
  if (!query.data) {
    return <StateView mode="empty" title="Order not found" message="It may belong to a different customer account." />;
  }

  return <OrderContent order={query.data} />;
}

function OrderContent({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const { addLine } = useCart();
  const [reordering, setReordering] = useState(false);
  const [reorderMessage, setReorderMessage] = useState<string | null>(null);
  const status = getOrderStatusPresentation(order);
  const lines = order.lineItems.edges.map((edge) => edge.node);
  const reorderLines = reorderLinesForOrder(lines);
  const supportEmail = configuredSupportEmail();
  const supportUrl = supportMailtoUrl(supportEmail, `Question about order ${order.name}`);

  const reorder = async () => {
    setReordering(true);
    setReorderMessage(null);
    let added = 0;
    try {
      for (const line of reorderLines) {
        await addLine(line.variantId, line.quantity);
        added += 1;
      }
      router.push('/cart');
    } catch {
      setReorderMessage(
        added
          ? 'Some items were added. Review your cart before trying the remaining items again.'
          : 'Those items couldn’t be added right now. Try again or shop for current alternatives.',
      );
    } finally {
      setReordering(false);
    }
  };

  const contactSupport = () => {
    if (supportUrl) void Linking.openURL(supportUrl);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: order.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">{order.name}</AppText>
        <AppText tone="textSecondary">Placed {formatOrderDate(order.processedAt, 'long')}</AppText>
        <View style={styles.badges}>
          <StatusBadge {...status.payment} />
          <StatusBadge {...status.fulfillment} />
        </View>

        {order.fulfillments.nodes.length ? (
          <Section title="Shipments">
            {order.fulfillments.nodes.map((fulfillment) => (
              <ShipmentCard key={fulfillment.id} fulfillment={fulfillment} />
            ))}
          </Section>
        ) : null}

        <Section title="Items">
          {lines.map((line) => {
            const optionText = line.variantOptions?.map((option) => option.value).join(' · ')
              || line.variantTitle;
            return (
              <View key={line.id} style={styles.itemRow}>
                <RemoteImage
                  uri={line.image?.url}
                  alt={line.image?.altText ?? line.title}
                  style={styles.itemImage}
                />
                <View style={styles.itemCopy}>
                  <AppText variant="labelStrong">{line.title}</AppText>
                  {optionText ? <AppText variant="caption" tone="textSecondary">{optionText}</AppText> : null}
                  <AppText variant="caption" tone="textSecondary">Quantity {line.quantity}</AppText>
                </View>
                {line.totalPrice ? <AppText variant="label">{formatMoney(line.totalPrice)}</AppText> : null}
              </View>
            );
          })}
        </Section>

        <Section title="Order total">
          {order.subtotal ? <CostRow label="Subtotal" value={formatMoney(order.subtotal)} /> : null}
          <CostRow label="Shipping" value={formatMoney(order.totalShipping)} />
          {order.totalTax ? <CostRow label="Tax" value={formatMoney(order.totalTax)} /> : null}
          {Number(order.totalRefunded.amount) > 0 ? (
            <CostRow label="Refunded" value={`−${formatMoney(order.totalRefunded)}`} />
          ) : null}
          <CostRow label="Total" value={formatMoney(order.totalPrice)} strong />
        </Section>

        {order.shippingAddress ? (
          <Section title="Shipping address">
            {(order.shippingAddress.formatted.length
              ? order.shippingAddress.formatted
              : [order.shippingAddress.address1, order.shippingAddress.address2,
                [order.shippingAddress.city, order.shippingAddress.zoneCode, order.shippingAddress.zip]
                  .filter(Boolean).join(', ')].filter(Boolean) as string[]
            ).map((line, index) => (
              <AppText key={`${line}-${index}`} variant="caption" tone="textSecondary">{line}</AppText>
            ))}
          </Section>
        ) : null}

        {reorderMessage ? <AppText accessibilityRole="alert" tone="sale">{reorderMessage}</AppText> : null}
        <AppButton
          label="Reorder available items"
          loading={reordering}
          disabled={!reorderLines.length}
          onPress={() => void reorder()}
        />
        {supportUrl ? (
          <AppButton label="Contact support about this order" variant="secondary" onPress={contactSupport} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function ShipmentCard({ fulfillment }: { fulfillment: OrderFulfillment }) {
  const status = fulfillment.latestShipmentStatus ?? fulfillment.status;
  return (
    <AppSurface variant="muted" style={styles.shipment}>
      <AppText variant="labelStrong">{status ? humanizeStatus(status) : 'Shipment'}</AppText>
      {fulfillment.estimatedDeliveryAt ? (
        <AppText variant="caption" tone="textSecondary">
          Estimated delivery {formatOrderDate(fulfillment.estimatedDeliveryAt, 'long')}
        </AppText>
      ) : null}
      {fulfillment.trackingInformation.map((tracking, index) => {
        const url = safeTrackingUrl(tracking.url);
        const label = [tracking.company, tracking.number].filter(Boolean).join(' · ') || 'Track shipment';
        return url ? (
          <AppButton
            key={`${tracking.number ?? 'tracking'}-${index}`}
            label={label}
            variant="secondary"
            onPress={() => void Linking.openURL(url)}
          />
        ) : (
          <AppText key={`${tracking.number ?? 'tracking'}-${index}`} variant="caption" tone="textSecondary">
            {label}
          </AppText>
        );
      })}
    </AppSurface>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

function CostRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.costRow}>
      <AppText variant={strong ? 'labelStrong' : 'body'}>{label}</AppText>
      <AppText variant={strong ? 'labelStrong' : 'body'}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.two },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  section: { gap: Spacing.two, paddingTop: Spacing.three },
  shipment: { padding: Spacing.three, gap: Spacing.one },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 72 },
  itemImage: { width: 64, height: 64, borderRadius: 10 },
  itemCopy: { flex: 1 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
