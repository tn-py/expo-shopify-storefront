import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState, LoadingState } from '@/components/screen-state';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import { useCart } from '@/shopify/cart';
import { useCheckout } from '@/shopify/checkout';
import type { CartLine } from '@/shopify/types';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { cart, ready, busy, updateLine, removeLine } = useCart();
  const { canCheckout, startCheckout } = useCheckout();

  if (!ready) return <LoadingState />;
  if (!cart || cart.totalQuantity === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        subtitle="Browse the catalog and add items to get started."
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.three,
          paddingHorizontal: Spacing.three,
          paddingBottom: Spacing.six,
        }}>
        <ThemedText type="title" style={styles.title}>
          Cart
        </ThemedText>

        {cart.lines.nodes.map((line) => (
          <LineRow
            key={line.id}
            line={line}
            disabled={busy}
            onInc={() => updateLine(line.id, line.quantity + 1)}
            onDec={() =>
              line.quantity <= 1
                ? removeLine(line.id)
                : updateLine(line.id, line.quantity - 1)
            }
            onRemove={() => removeLine(line.id)}
          />
        ))}

        <View style={[styles.summary, { borderTopColor: theme.backgroundElement }]}>
          <Row label="Subtotal" value={formatMoney(cart.cost.subtotalAmount)} />
          {cart.cost.totalTaxAmount ? (
            <Row label="Tax" value={formatMoney(cart.cost.totalTaxAmount)} />
          ) : null}
          <Row label="Total" value={formatMoney(cart.cost.totalAmount)} bold />
          <ThemedText type="small" themeColor="textSecondary">
            Shipping and discounts are calculated at checkout.
          </ThemedText>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.two, backgroundColor: theme.background },
        ]}>
        <Pressable
          onPress={startCheckout}
          disabled={!canCheckout || busy}
          style={[styles.checkoutBtn, (!canCheckout || busy) && { opacity: 0.5 }]}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.checkoutText}>
              Checkout · {formatMoney(cart.cost.totalAmount)}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

function LineRow({
  line,
  disabled,
  onInc,
  onDec,
  onRemove,
}: {
  line: CartLine;
  disabled: boolean;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const m = line.merchandise;
  const variantLabel = m.selectedOptions
    .filter((o) => o.value !== 'Default Title')
    .map((o) => o.value)
    .join(' · ');

  return (
    <View style={styles.line}>
      <Link href={`/product/${m.product.handle}`} asChild>
        <Pressable
          style={() => [styles.lineImage, { backgroundColor: theme.backgroundElement }]}>
          {m.image ? (
            <Image source={{ uri: m.image.url }} style={{ flex: 1 }} contentFit="contain" />
          ) : null}
        </Pressable>
      </Link>
      <View style={styles.lineBody}>
        <ThemedText type="small" numberOfLines={2}>
          {m.product.title}
        </ThemedText>
        {variantLabel ? (
          <ThemedText type="small" themeColor="textSecondary">
            {variantLabel}
          </ThemedText>
        ) : null}
        <ThemedText type="smallBold">{formatMoney(line.cost.totalAmount)}</ThemedText>

        <View style={styles.qtyRow}>
          <Stepper label="−" onPress={onDec} disabled={disabled} />
          <ThemedText type="small">{line.quantity}</ThemedText>
          <Stepper label="+" onPress={onInc} disabled={disabled} />
          <Pressable onPress={onRemove} disabled={disabled} style={styles.remove}>
            <ThemedText type="link">Remove</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Stepper({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.stepper, { borderColor: theme.backgroundSelected }]}>
      <ThemedText>{label}</ThemedText>
    </Pressable>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText type={bold ? 'smallBold' : 'small'}>{label}</ThemedText>
      <ThemedText type={bold ? 'smallBold' : 'small'}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { marginBottom: Spacing.three },
  line: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.three },
  lineImage: { width: 72, height: 72, borderRadius: Spacing.two, overflow: 'hidden' },
  lineBody: { flex: 1, gap: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.one },
  stepper: {
    width: 32,
    height: 32,
    borderRadius: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: { marginLeft: 'auto' },
  summary: { marginTop: Spacing.three, paddingTop: Spacing.three, borderTopWidth: 1, gap: Spacing.two },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  checkoutBtn: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontFamily: Fonts.bold, fontSize: 16 },
});
