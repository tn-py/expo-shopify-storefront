import { Link, Stack } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-state';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/shopify/auth';
import { useOrders, type OrderSummary } from '@/shopify/customer';

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function OrdersScreen() {
  const theme = useTheme();
  const { isAuthenticated, getAccessToken } = useAuth();
  const q = useOrders(getAccessToken, isAuthenticated);

  const orders = useMemo(
    () => q.data?.pages.flatMap((p) => p.customer.orders.edges.map((e) => e.node)) ?? [],
    [q.data],
  );

  if (!isAuthenticated) return <EmptyState title="Sign in to view your orders" />;
  if (q.isPending) return <LoadingState />;
  if (q.isError) {
    return <ErrorState message={(q.error as Error).message} onRetry={q.refetch} />;
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Orders' }} />
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        onRefresh={q.refetch}
        refreshing={q.isRefetching}
        onEndReachedThreshold={0.5}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="No orders yet" />}
        renderItem={({ item }) => <OrderRow order={item} border={theme.border} />}
      />
    </ThemedView>
  );
}

function OrderRow({ order, border }: { order: OrderSummary; border: string }) {
  const items = order.lineItems.edges.map((e) => e.node);
  const summary = items
    .map((i) => `${i.quantity}× ${i.title}`)
    .join(', ');

  return (
    <Link href={`/account/order/${encodeURIComponent(order.id)}` as never} asChild>
      <Pressable style={[styles.row, { borderColor: border }]}>
        <View style={styles.rowTop}>
          <ThemedText type="smallBold">{order.name}</ThemedText>
          <ThemedText type="smallBold">{formatMoney(order.totalPrice)}</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(order.processedAt)}
          {order.financialStatus ? `  ·  ${humanize(order.financialStatus)}` : ''}
        </ThemedText>
        {summary ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {summary}
          </ThemedText>
        ) : null}
      </Pressable>
    </Link>
  );
}

export function humanize(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
});
