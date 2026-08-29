import { Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-state';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/shopify/auth';
import { useAddresses, type CustomerAddress } from '@/shopify/customer';

export default function AddressesScreen() {
  const theme = useTheme();
  const { isAuthenticated, getAccessToken } = useAuth();
  const { data, isPending, isError, error, refetch, isRefetching } = useAddresses(
    getAccessToken,
    isAuthenticated,
  );

  if (!isAuthenticated) return <EmptyState title="Sign in to manage addresses" />;
  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Addresses' }} />
      <FlatList
        data={data?.addresses ?? []}
        keyExtractor={(a) => a.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="No saved addresses"
            subtitle="Addresses you use at checkout will appear here."
          />
        }
        ListFooterComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            Add or edit addresses during checkout or in your Shopify account online.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <AddressCard
            address={item}
            isDefault={item.id === data?.defaultId}
            border={theme.border}
            accent={theme.primary}
          />
        )}
      />
    </ThemedView>
  );
}

function AddressCard({
  address,
  isDefault,
  border,
  accent,
}: {
  address: CustomerAddress;
  isDefault: boolean;
  border: string;
  accent: string;
}) {
  const name = [address.firstName, address.lastName].filter(Boolean).join(' ');
  return (
    <View style={[styles.card, { borderColor: border }]}>
      <View style={styles.cardTop}>
        <ThemedText type="smallBold">{name || 'Address'}</ThemedText>
        {isDefault ? (
          <ThemedText type="small" style={{ color: accent }}>
            Default
          </ThemedText>
        ) : null}
      </View>
      {[
        [address.address1, address.address2].filter(Boolean).join(', '),
        [address.city, address.zoneCode, address.zip].filter(Boolean).join(', '),
        address.territoryCode,
        address.phoneNumber,
      ]
        .filter(Boolean)
        .map((line, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary">
            {line}
          </ThemedText>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  footer: { textAlign: 'center', paddingVertical: Spacing.three },
});
