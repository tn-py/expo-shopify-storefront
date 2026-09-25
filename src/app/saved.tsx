import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCatalogColumnCount, ProductCard } from '@/components/commerce';
import { ErrorState } from '@/components/screen-state';
import { AppSurface, AppText, CatalogGrid, StateView } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { screen } from '@/lib/analytics';
import { useWishlistProducts } from '@/shopify/hooks';
import { useWishlist } from '@/wishlist/wishlist';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columns = getCatalogColumnCount(width);
  const { items, ready } = useWishlist();
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const { data, isPending, isError, error, refetch, isRefetching } = useWishlistProducts(ids);

  useEffect(() => screen('Saved'), []);

  // Refreshed products win (current price/availability); fall back to the
  // local snapshot only while that refresh is still in flight.
  const products = data ?? (ids.length ? items : []);

  if (!ready || (ids.length > 0 && isPending)) {
    return <StateView mode="loading" title="Loading saved items…" />;
  }
  if (ids.length > 0 && isError && !data) {
    return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  }
  if (!products.length) {
    return (
      <StateView
        mode="empty"
        title="Nothing saved yet"
        message="Tap the heart on a product to save it here."
        actionLabel="Browse products"
        onAction={() => router.push('/shop')}
      />
    );
  }

  return (
    <AppSurface style={styles.container}>
      <Stack.Screen options={{ title: 'Saved' }} />
      <CatalogGrid
        key={`saved-${columns}`}
        columns={columns}
        data={products}
        onRefresh={ids.length ? refetch : undefined}
        refreshing={isRefetching}
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.six },
        ]}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="title">Saved</AppText>
            <AppText tone="textSecondary">
              {products.length} {products.length === 1 ? 'item' : 'items'}
            </AppText>
          </View>
        }
        renderItem={({ item }) => <ProductCard product={item} />}
      />
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 0 },
  list: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.two },
  header: { gap: Spacing.one, paddingHorizontal: Spacing.one, paddingBottom: Spacing.three },
  row: { alignItems: 'stretch' },
});
