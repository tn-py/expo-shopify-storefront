import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  canLoadNextPage,
  CatalogSkeleton,
  getCatalogColumnCount,
  getSupportedFilters,
  ProductCard,
} from '@/components/commerce';
import { ErrorState, LoadingState } from '@/components/screen-state';
import {
  AppButton,
  AppSurface,
  AppText,
  CatalogGrid,
  RemoteImage,
  SelectableChip,
  StateView,
} from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useCollection } from '@/shopify/hooks';
import type { CollectionSortKey, ProductFilterValue } from '@/shopify/types';

const SORTS: { label: string; key: CollectionSortKey; reverse: boolean }[] = [
  { label: 'Featured', key: 'COLLECTION_DEFAULT', reverse: false },
  { label: 'Best selling', key: 'BEST_SELLING', reverse: false },
  { label: 'Newest', key: 'CREATED', reverse: true },
  { label: 'Price: low to high', key: 'PRICE', reverse: false },
  { label: 'Price: high to low', key: 'PRICE', reverse: true },
  { label: 'Name: A to Z', key: 'TITLE', reverse: false },
];

export default function CollectionScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { width } = useWindowDimensions();
  const columns = getCatalogColumnCount(width);
  const [sortIndex, setSortIndex] = useState(0);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, ProductFilterValue>>({});
  const sort = SORTS[sortIndex];
  const filterInputs = useMemo(
    () => Object.values(selectedFilters).map((value) => value.input),
    [selectedFilters],
  );
  const query = useCollection(handle ?? '', sort.key, sort.reverse, filterInputs);
  const collection = query.data?.pages[0]?.collection ?? null;
  const products = useMemo(
    () => query.data?.pages.flatMap((page) => page.collection?.products.nodes ?? []) ?? [],
    [query.data],
  );
  const filters = getSupportedFilters(collection?.products.filters);
  const collectionHandle = collection?.handle;

  useEffect(() => {
    if (collectionHandle) track('collection_viewed', { handle: collectionHandle });
  }, [collectionHandle]);

  if (query.isPending) return <LoadingState label="Loading collection…" />;
  if (query.isError && !query.data) {
    return <ErrorState message={(query.error as Error).message} onRetry={query.refetch} />;
  }
  if (!collection) {
    return (
      <StateView
        mode="empty"
        title="Collection not found"
        message="This collection may have moved or is no longer available."
      />
    );
  }

  const toggleFilter = (value: ProductFilterValue) => {
    setSelectedFilters((current) => {
      if (current[value.id]) {
        const { [value.id]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [value.id]: value };
    });
    track('collection_filter_changed', {
      handle: collection.handle,
      filter: value.label,
      selected: !selectedFilters[value.id],
    });
  };

  return (
    <AppSurface style={styles.container}>
      <Stack.Screen options={{ title: collection.title }} />
      <CatalogGrid
        key={`collection-${columns}`}
        columns={columns}
        data={products}
        onRefresh={query.refetch}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (
            canLoadNextPage({
              hasNextPage: Boolean(query.hasNextPage),
              isFetchingNextPage: query.isFetchingNextPage,
            })
          ) {
            query.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            {collection.image ? (
              <RemoteImage
                uri={collection.image.url}
                alt={collection.image.altText ?? collection.title}
                style={styles.contextImage}
              />
            ) : null}
            <AppText variant="title">{collection.title}</AppText>
            {collection.description ? (
              <AppText tone="textSecondary">{collection.description}</AppText>
            ) : null}
            <AppText variant="caption" tone="textSecondary">
              Showing {products.length}{query.hasNextPage ? '+' : ''} {products.length === 1 ? 'product' : 'products'}
            </AppText>

            <View style={styles.controlGroup}>
              <AppText variant="labelStrong">Sort by</AppText>
              <View style={styles.chips}>
                {SORTS.map((item, index) => (
                  <SelectableChip
                    key={`${item.key}-${item.reverse}`}
                    label={item.label}
                    selected={sortIndex === index}
                    onPress={() => {
                      setSortIndex(index);
                      track('collection_sort_changed', { handle: collection.handle, sort: item.label });
                    }}
                  />
                ))}
              </View>
            </View>

            {filters.map((filter) => (
              <View key={filter.id} style={styles.controlGroup}>
                <AppText variant="labelStrong">{filter.label}</AppText>
                <View style={styles.chips}>
                  {filter.values.map((value) => (
                    <SelectableChip
                      key={value.id}
                      label={`${value.label} (${value.count})`}
                      selected={Boolean(selectedFilters[value.id])}
                      disabled={value.count === 0 && !selectedFilters[value.id]}
                      onPress={() => toggleFilter(value)}
                    />
                  ))}
                </View>
              </View>
            ))}
            {Object.keys(selectedFilters).length ? (
              <View style={styles.clearFilters}>
                <AppButton label="Clear filters" variant="tertiary" onPress={() => setSelectedFilters({})} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <StateView
            mode="empty"
            title={filterInputs.length ? 'No products match these filters' : 'No products in this collection yet'}
            message={filterInputs.length ? 'Clear a filter to see more products.' : undefined}
            actionLabel={filterInputs.length ? 'Clear filters' : undefined}
            onAction={filterInputs.length ? () => setSelectedFilters({}) : undefined}
          />
        }
        ListFooterComponent={
          query.isFetchNextPageError ? (
            <View style={styles.paginationError}>
              <AppText variant="caption" tone="textSecondary">Couldn’t load more products. Your current items are still here.</AppText>
              <AppButton label="Try again" variant="secondary" onPress={() => query.fetchNextPage()} />
            </View>
          ) : query.isFetchingNextPage ? (
            <CatalogSkeleton label="Loading more products" />
          ) : null
        }
        renderItem={({ item }) => <ProductCard product={item} />}
      />
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 0 },
  list: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.two, paddingBottom: Spacing.six },
  row: { alignItems: 'stretch' },
  header: { gap: Spacing.three, padding: Spacing.one, paddingBottom: Spacing.three },
  contextImage: { width: '100%', aspectRatio: 16 / 7, borderRadius: 14 },
  controlGroup: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  clearFilters: { alignItems: 'flex-start' },
  paginationError: { alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
});
