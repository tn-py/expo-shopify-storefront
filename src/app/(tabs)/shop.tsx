import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionCard, getCatalogColumnCount } from '@/components/commerce';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-state';
import { AppSurface, AppText, CatalogGrid } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { screen } from '@/lib/analytics';
import { useCollections } from '@/shopify/hooks';

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = getCatalogColumnCount(width);
  const { data, isPending, isError, error, refetch, isRefetching } = useCollections();

  useEffect(() => screen('Shop'), []);

  if (isPending) return <LoadingState label="Loading collections…" />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  if (!data?.length) {
    return <EmptyState title="No collections yet" subtitle="Please check back soon." />;
  }

  return (
    <AppSurface style={styles.container}>
      <CatalogGrid
        key={`shop-${columns}`}
        columns={columns}
        data={data}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
        ]}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="title">Shop</AppText>
            <AppText tone="textSecondary">Explore every collection in the catalog.</AppText>
          </View>
        }
        renderItem={({ item }) => <CollectionCard collection={item} />}
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
