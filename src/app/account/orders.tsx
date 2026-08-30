import { Link, Stack } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { CustomerAuthGate, type AuthenticatedCustomerAccess } from '@/components/customer-auth-gate';
import { AppButton, AppText, OrderCard, StateView } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { usePaginationLock } from '@/hooks/use-pagination-lock';
import { useOrders } from '@/shopify/customer';

export default function OrdersScreen() {
  return (
    <CustomerAuthGate>
      {(access) => <AuthenticatedOrders access={access} />}
    </CustomerAuthGate>
  );
}

function AuthenticatedOrders({ access }: { access: AuthenticatedCustomerAccess }) {
  const query = useOrders(access.getAccessToken, access.customerSessionKey);
  const loadNextPage = usePaginationLock({
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  });
  const pages = query.data?.pages;
  const orders = useMemo(
    () => pages?.flatMap((page) => page.customer.orders.edges.map((edge) => edge.node)) ?? [],
    [pages],
  );

  if (query.isPending) return <StateView mode="loading" title="Loading orders…" />;
  if (query.isError && !pages) {
    return (
      <StateView
        mode="error"
        title="We couldn’t load your orders"
        message={(query.error as Error).message}
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Orders' }} />
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        onRefresh={query.refetch}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadNextPage()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <StateView
            mode="empty"
            title="No orders yet"
            message="Orders placed with this customer account will appear here."
          />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {query.isFetchNextPageError ? (
              <AppButton
                label="Retry loading more orders"
                variant="secondary"
                onPress={() => void loadNextPage()}
              />
            ) : null}
            {query.isFetchingNextPage ? <AppText tone="textSecondary">Loading more…</AppText> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Link href={`/account/order/${encodeURIComponent(item.id)}` as never} asChild>
            <OrderCard order={item} />
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1 },
  footer: { gap: Spacing.two, paddingVertical: Spacing.two },
});
