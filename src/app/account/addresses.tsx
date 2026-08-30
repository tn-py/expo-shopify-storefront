import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { CustomerAuthGate, type AuthenticatedCustomerAccess } from '@/components/customer-auth-gate';
import { AppButton, AppSurface, AppText, StateView, StatusBadge } from '@/components/ui';
import { safeCustomerAccountManagementUrl } from '@/config/account-links';
import { Spacing } from '@/constants/theme';
import { usePaginationLock } from '@/hooks/use-pagination-lock';
import { ShopifyEnv } from '@/shopify/env';
import { useAddresses, type CustomerAddress } from '@/shopify/customer';

export default function AddressesScreen() {
  return (
    <CustomerAuthGate>
      {(access) => <AuthenticatedAddresses access={access} />}
    </CustomerAuthGate>
  );
}

function AuthenticatedAddresses({ access }: { access: AuthenticatedCustomerAccess }) {
  const query = useAddresses(access.getAccessToken, access.customerSessionKey);
  const loadNextPage = usePaginationLock({
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  });
  const pages = query.data?.pages;
  const addresses = useMemo(
    () => pages?.flatMap((page) => page.customer.addresses.edges.map((edge) => edge.node)) ?? [],
    [pages],
  );
  const defaultId = pages?.[0]?.customer.defaultAddress?.id ?? null;
  const managementUrl = safeCustomerAccountManagementUrl(ShopifyEnv.customerAccountManagementUrl);

  if (query.isPending) return <StateView mode="loading" title="Loading addresses…" />;
  if (query.isError && !pages) {
    return (
      <StateView
        mode="error"
        title="We couldn’t load your addresses"
        message={(query.error as Error).message}
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Addresses' }} />
      <FlatList
        data={addresses}
        keyExtractor={(address) => address.id}
        onRefresh={query.refetch}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadNextPage()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <AppText tone="textSecondary">
            Saved addresses are shown exactly as Shopify formats them for their locale.
          </AppText>
        }
        ListEmptyComponent={
          <StateView
            mode="empty"
            title="No saved addresses"
            message="Addresses saved to your Shopify account will appear here."
          />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {query.isFetchNextPageError ? (
              <AppButton
                label="Retry loading more addresses"
                variant="secondary"
                onPress={() => void loadNextPage()}
              />
            ) : null}
            {query.isFetchingNextPage ? <AppText tone="textSecondary">Loading more…</AppText> : null}
            <AppText variant="caption" tone="textSecondary" style={styles.centered}>
              Address changes are completed in your secure Shopify customer account.
            </AppText>
            {managementUrl ? (
              <AppButton
                label="Manage addresses online"
                variant="secondary"
                onPress={() => void Linking.openURL(managementUrl)}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <AddressCard address={item} isDefault={item.id === defaultId} />
        )}
      />
    </View>
  );
}

function AddressCard({ address, isDefault }: { address: CustomerAddress; isDefault: boolean }) {
  const fallback = [
    [address.firstName, address.lastName].filter(Boolean).join(' '),
    address.address1,
    address.address2,
    [address.city, address.zoneCode, address.zip].filter(Boolean).join(', '),
    address.territoryCode,
  ].filter((line): line is string => Boolean(line));
  const lines = address.formatted.length ? address.formatted : fallback;

  return (
    <AppSurface variant="raised" style={styles.card} accessibilityLabel={isDefault ? 'Default address' : 'Saved address'}>
      <View style={styles.cardTop}>
        <AppText variant="labelStrong">Saved address</AppText>
        {isDefault ? <StatusBadge label="Default" tone="success" /> : null}
      </View>
      {lines.map((line, index) => (
        <AppText key={`${line}-${index}`} variant="caption" tone="textSecondary">
          {line}
        </AppText>
      ))}
      {address.phoneNumber ? (
        <AppText variant="caption" tone="textSecondary">{address.phoneNumber}</AppText>
      ) : null}
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1 },
  card: { padding: Spacing.three, gap: Spacing.half },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, marginBottom: Spacing.one },
  footer: { gap: Spacing.two, paddingVertical: Spacing.three },
  centered: { textAlign: 'center' },
});
