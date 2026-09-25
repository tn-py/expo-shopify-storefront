import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WalletCheckoutButtons } from '@/components/commerce';
import {
  AppButton,
  AppSurface,
  AppText,
  AppTextField,
  Price,
  QuantityStepper,
  RemoteImage,
  StateView,
  StatusBadge,
  StickyActionBar,
} from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { hapticSuccess } from '@/lib/haptics';
import { formatMoney } from '@/lib/format';
import { useCart } from '@/shopify/cart';
import { cartDiscountTotal, type CartOperationStatus } from '@/shopify/cart-operations';
import { useCheckout } from '@/shopify/checkout';
import type { Cart, CartLine, CartWarning } from '@/shopify/types';

type RetryRequest =
  | { kind: 'update'; quantity: number }
  | { kind: 'remove' };

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    cart,
    ready,
    operations,
    lastRemovedLine,
    warnings,
    dismissWarnings,
    updateLine,
    removeLine,
    undoRemove,
    applyDiscountCode,
    removeDiscountCode,
    clearOperationError,
    buyerIdentityError,
    buyerIdentityErrorKind,
    retryBuyerIdentity,
  } = useCart();
  const { canCheckout, startCheckout, presenting, error: checkoutError, recovered } = useCheckout();
  const [retryByLine, setRetryByLine] = useState<Record<string, RetryRequest>>({});

  const retryCheckoutIdentity = async () => {
    try {
      await retryBuyerIdentity();
    } catch {
      // The cart identity state keeps actionable feedback visible.
    }
  };

  const undo = async () => {
    clearOperationError('undo');
    try {
      await undoRemove();
    } catch {
      // Operation-specific feedback is rendered from the cart context.
    }
  };

  if (!ready) return <StateView mode="loading" title="Loading your cart…" />;
  if (!cart || cart.totalQuantity === 0) {
    return (
      <AppSurface style={styles.container}>
        <View style={[styles.emptyContent, { paddingBottom: insets.bottom + Spacing.three }]}>
          <StateView
            mode="empty"
            title="Your cart is empty"
            message="Explore the shop and add something made for everyday use."
            actionLabel="Browse products"
            onAction={() => router.push('/shop')}
          />
          <RemovalFeedback
            line={lastRemovedLine}
            pending={operations.undo?.pending}
            error={operations.undo?.error}
            onUndo={undo}
          />
        </View>
      </AppSurface>
    );
  }

  const discountTotal = cartDiscountTotal(cart);

  const runRequest = async (line: CartLine, request: RetryRequest) => {
    const key = `line:${line.id}`;
    clearOperationError(key);
    try {
      if (request.kind === 'remove') await removeLine(line.id);
      else await updateLine(line.id, request.quantity);
      setRetryByLine((current) => {
        const next = { ...current };
        delete next[line.id];
        return next;
      });
    } catch {
      setRetryByLine((current) => ({ ...current, [line.id]: request }));
    }
  };

  return (
    <AppSurface style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 156 + insets.bottom }]}>
        <View style={styles.heading}>
          <AppText variant="title">Your cart</AppText>
          <AppText tone="textSecondary">
            {cart.totalQuantity} {cart.totalQuantity === 1 ? 'item' : 'items'}
          </AppText>
        </View>

        <RemovalFeedback
          line={lastRemovedLine}
          pending={operations.undo?.pending}
          error={operations.undo?.error}
          onUndo={undo}
        />

        <WarningsBanner warnings={warnings} onDismiss={dismissWarnings} />

        <View style={styles.lines}>
          {cart.lines.nodes.map((line) => (
            <CartLineRow
              key={line.id}
              line={line}
              operation={operations[`line:${line.id}`]}
              retry={retryByLine[line.id]}
              onRequest={(request) => runRequest(line, request)}
            />
          ))}
        </View>

        <DiscountSection
          cart={cart}
          pending={operations.discount?.pending}
          error={operations.discount?.error}
          onClearError={() => clearOperationError('discount')}
          onApply={applyDiscountCode}
          onRemove={removeDiscountCode}
        />

        <AppSurface variant="muted" style={styles.summary}>
          <SummaryRow label="Subtotal" value={formatMoney(cart.cost.subtotalAmount)} />
          {discountTotal ? (
            <SummaryRow label="Discount" value={`−${formatMoney(discountTotal)}`} tone="sale" />
          ) : null}
          <SummaryRow label="Estimated total" value={formatMoney(cart.cost.totalAmount)} strong />
          <AppText variant="caption" tone="textSecondary">
            Taxes and shipping calculated at checkout.
          </AppText>
        </AppSurface>

        <View style={styles.reassurance}>
          <AppText variant="labelStrong">Checkout you can trust</AppText>
          <AppText tone="textSecondary">
            Payment is completed securely in Shopify Checkout. You can review delivery,
            returns, and the final total before placing your order.
          </AppText>
        </View>

        {buyerIdentityError ? (
          <AppSurface accessibilityRole="alert" variant="muted" style={styles.errorBox}>
            <AppText variant="labelStrong">Checkout identity needs attention</AppText>
            <AppText tone="sale">{buyerIdentityError}</AppText>
            <AppButton
              label={
                buyerIdentityErrorKind === 'profile'
                  ? 'Retry customer profile'
                  : 'Retry checkout setup'
              }
              variant="secondary"
              loading={operations.buyerIdentity?.pending}
              onPress={() => { void retryCheckoutIdentity(); }}
            />
          </AppSurface>
        ) : null}

        {checkoutError ? (
          <AppSurface accessibilityRole="alert" variant="muted" style={styles.errorBox}>
            <AppText variant="labelStrong">{recovered ? 'Cart refreshed' : 'Checkout needs attention'}</AppText>
            <AppText tone={recovered ? 'textSecondary' : 'sale'}>{checkoutError}</AppText>
          </AppSurface>
        ) : null}
      </ScrollView>

      <StickyActionBar style={{ paddingBottom: insets.bottom + Spacing.two }}>
        <View style={styles.stickyWallet}>
          <WalletCheckoutButtons cartId={cart.id} />
        </View>
        <View style={styles.stickyContent}>
          <View style={styles.stickyTotal}>
            <AppText variant="caption" tone="textSecondary">Estimated total</AppText>
            <Price
              amount={cart.cost.totalAmount.amount}
              currencyCode={cart.cost.totalAmount.currencyCode}
            />
          </View>
          <View style={styles.checkoutAction}>
            <AppButton
              label={`Checkout · ${formatMoney(cart.cost.totalAmount)}`}
              loading={presenting}
              disabled={!canCheckout}
              onPress={startCheckout}
            />
          </View>
        </View>
      </StickyActionBar>
    </AppSurface>
  );
}

function RemovalFeedback({
  line,
  pending,
  error,
  onUndo,
}: {
  line: CartLine | null;
  pending?: boolean;
  error?: string | null;
  onUndo: () => void;
}) {
  if (!line) return null;
  return (
    <View style={styles.removalFeedback}>
      <AppSurface accessibilityRole="alert" variant="muted" style={styles.feedback}>
        <View style={styles.feedbackCopy}>
          <AppText variant="labelStrong">Item removed</AppText>
          <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
            {line.merchandise.product.title}
          </AppText>
        </View>
        <AppButton
          label="Undo remove"
          variant="secondary"
          loading={pending}
          onPress={onUndo}
        />
      </AppSurface>
      {error ? (
        <AppSurface accessibilityRole="alert" variant="muted" style={styles.errorBox}>
          <AppText tone="sale">{error}</AppText>
          <AppButton label="Try undo again" variant="secondary" onPress={onUndo} />
        </AppSurface>
      ) : null}
    </View>
  );
}

/** Non-blocking cart warnings from Shopify (e.g. a quantity adjusted for stock). */
function WarningsBanner({
  warnings,
  onDismiss,
}: {
  warnings: CartWarning[];
  onDismiss: () => void;
}) {
  if (!warnings.length) return null;
  return (
    <AppSurface accessibilityRole="alert" variant="muted" style={styles.warningsBox}>
      {warnings.map((warning, index) => (
        <AppText key={`${warning.code}:${warning.target}:${index}`} variant="caption">
          {warning.message}
        </AppText>
      ))}
      <AppButton label="Dismiss" variant="tertiary" onPress={onDismiss} />
    </AppSurface>
  );
}

function DiscountSection({
  cart,
  pending,
  error,
  onClearError,
  onApply,
  onRemove,
}: {
  cart: Cart;
  pending?: boolean;
  error?: string | null;
  onClearError: () => void;
  onApply: (code: string) => Promise<void>;
  onRemove: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [removingCode, setRemovingCode] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    onClearError();
    try {
      await onApply(trimmed);
      setCode('');
      hapticSuccess();
    } catch {
      // The operation error surfaces below the field.
    }
  };

  const remove = async (discountCode: string) => {
    onClearError();
    setRemovingCode(discountCode);
    try {
      await onRemove(discountCode);
    } catch {
      // The operation error surfaces below the field.
    } finally {
      setRemovingCode(null);
    }
  };

  return (
    <AppSurface variant="muted" style={styles.discountSection}>
      <AppText variant="labelStrong">Discount code</AppText>
      <View style={styles.discountRow}>
        <View style={styles.discountField}>
          <AppTextField
            placeholder="Enter code"
            accessibilityLabel="Discount code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!pending}
            returnKeyType="done"
            onSubmitEditing={() => { void submit(); }}
          />
        </View>
        <AppButton
          label="Apply"
          variant="secondary"
          loading={pending && !removingCode}
          disabled={!code.trim()}
          onPress={() => { void submit(); }}
        />
      </View>
      {error ? <AppText variant="caption" tone="sale">{error}</AppText> : null}
      {cart.discountCodes.length ? (
        <View style={styles.discountChips}>
          {cart.discountCodes.map((entry) => (
            <View key={entry.code} style={styles.discountChip}>
              <View style={styles.discountChipRow}>
                <StatusBadge label={entry.code} tone={entry.applicable ? 'success' : 'warning'} />
                <AppButton
                  label="Remove"
                  accessibilityLabel={`Remove discount code ${entry.code}`}
                  variant="tertiary"
                  loading={pending && removingCode === entry.code}
                  disabled={pending && removingCode !== entry.code}
                  onPress={() => { void remove(entry.code); }}
                />
              </View>
              {!entry.applicable ? (
                <AppText variant="caption" tone="textSecondary">
                  This code doesn’t currently apply to your cart.
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </AppSurface>
  );
}

function CartLineRow({
  line,
  operation,
  retry,
  onRequest,
}: {
  line: CartLine;
  operation?: CartOperationStatus;
  retry?: RetryRequest;
  onRequest: (request: RetryRequest) => Promise<void>;
}) {
  const merchandise = line.merchandise;
  const [optimisticQuantity, setOptimisticQuantity] = useState<number | null>(null);
  const displayedQuantity = optimisticQuantity ?? line.quantity;
  const variantLabel = merchandise.selectedOptions
    .filter((option) => option.value !== 'Default Title')
    .map((option) => option.value)
    .join(' · ');

  return (
    <AppSurface variant="raised" style={styles.line}>
      <Link href={`/product/${merchandise.product.handle}`} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={merchandise.product.title} style={styles.imageLink}>
          <RemoteImage
            uri={merchandise.image?.url}
            alt={merchandise.image?.altText ?? merchandise.product.title}
            contentFit="contain"
            style={styles.image}
          />
        </Pressable>
      </Link>
      <View style={styles.lineBody}>
        <View style={styles.lineIdentity}>
          <AppText variant="labelStrong" numberOfLines={2}>{merchandise.product.title}</AppText>
          {variantLabel ? <AppText variant="caption" tone="textSecondary">{variantLabel}</AppText> : null}
          <Price
            amount={line.cost.totalAmount.amount}
            currencyCode={line.cost.totalAmount.currencyCode}
          />
        </View>
        <View style={styles.lineActions}>
          <QuantityStepper
            value={displayedQuantity}
            busy={operation?.pending && operation.kind === 'update'}
            disabled={operation?.pending && operation.kind === 'remove'}
            onChange={(quantity) => {
              setOptimisticQuantity(quantity);
              void onRequest({ kind: 'update', quantity })
                .finally(() => setOptimisticQuantity(null));
            }}
          />
          <View style={styles.removeAction}>
            <AppButton
              label="Remove"
              accessibilityLabel={`Remove ${merchandise.product.title}`}
              variant="tertiary"
              loading={operation?.pending && operation.kind === 'remove'}
              disabled={operation?.pending}
              onPress={() => { void onRequest({ kind: 'remove' }); }}
            />
          </View>
        </View>
        {operation?.error ? (
          <View accessibilityRole="alert" style={styles.lineError}>
            <AppText variant="caption" tone="sale">{operation.error}</AppText>
            {retry ? (
              <AppButton label="Try again" variant="secondary" onPress={() => { void onRequest(retry); }} />
            ) : null}
          </View>
        ) : null}
      </View>
    </AppSurface>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'sale';
}) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant={strong ? 'labelStrong' : 'label'} tone={tone}>{label}</AppText>
      <AppText variant={strong ? 'price' : 'label'} tone={tone}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 0 },
  emptyContent: { flex: 1, gap: Spacing.three, paddingHorizontal: Spacing.three },
  scrollContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
    padding: Spacing.three,
  },
  heading: { gap: Spacing.one },
  lines: { gap: Spacing.three },
  line: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three },
  imageLink: { width: 96, minHeight: 112 },
  image: { width: 96, height: 112, borderRadius: 10 },
  lineBody: { flex: 1, gap: Spacing.three },
  lineIdentity: { gap: Spacing.one },
  lineActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  removeAction: { minWidth: 96, marginLeft: 'auto' },
  lineError: { gap: Spacing.two },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  feedbackCopy: { flex: 1 },
  removalFeedback: { gap: Spacing.two },
  summary: { gap: Spacing.two, padding: Spacing.three },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  reassurance: { gap: Spacing.two },
  errorBox: { gap: Spacing.two, padding: Spacing.three },
  warningsBox: { gap: Spacing.two, padding: Spacing.three },
  discountSection: { gap: Spacing.two, padding: Spacing.three },
  discountRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  discountField: { flex: 1 },
  discountChips: { gap: Spacing.two },
  discountChip: { gap: Spacing.one },
  discountChipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stickyWallet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  stickyContent: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stickyTotal: { flex: 0.85 },
  checkoutAction: { flex: 1.4 },
});
