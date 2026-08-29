import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/product-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-state';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { useCollection } from '@/shopify/hooks';

const SORTS = [
  { label: 'Featured', key: 'COLLECTION_DEFAULT', reverse: false },
  { label: 'Newest', key: 'CREATED', reverse: true },
  { label: 'Price ↑', key: 'PRICE', reverse: false },
  { label: 'Price ↓', key: 'PRICE', reverse: true },
  { label: 'Best selling', key: 'BEST_SELLING', reverse: false },
] as const;

export default function CollectionScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const theme = useTheme();
  const [sortIndex, setSortIndex] = useState(0);
  const sort = SORTS[sortIndex];

  const query = useCollection(handle ?? '', sort.key, sort.reverse);
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = query;

  const collection = data?.pages[0]?.collection ?? null;
  const products = useMemo(
    () => data?.pages.flatMap((p) => p.collection?.products.nodes ?? []) ?? [],
    [data],
  );

  useEffect(() => {
    if (collection) track('collection_viewed', { handle: collection.handle });
  }, [collection]);

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  if (!collection) return <ErrorState message="Collection not found" />;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: collection.title }} />
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        onRefresh={refetch}
        refreshing={isRefetching}
        onEndReachedThreshold={0.5}
        onEndReached={() => hasNextPage && fetchNextPage()}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {collection.description ? (
              <ThemedText type="small" themeColor="textSecondary">
                {collection.description}
              </ThemedText>
            ) : null}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={SORTS}
              keyExtractor={(s) => s.label}
              contentContainerStyle={{ gap: Spacing.two, paddingVertical: Spacing.two }}
              renderItem={({ item, index }) => {
                const active = index === sortIndex;
                return (
                  <Pressable
                    onPress={() => setSortIndex(index)}
                    style={[
                      styles.sortChip,
                      {
                        borderColor: active ? theme.text : theme.backgroundSelected,
                        backgroundColor: active ? theme.backgroundSelected : 'transparent',
                      },
                    ]}>
                    <ThemedText type="small">{item.label}</ThemedText>
                  </Pressable>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={<EmptyState title="No products in this category yet" />}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
              Loading more…
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => <ProductCard product={item} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.six },
  header: { paddingHorizontal: Spacing.one, gap: Spacing.one },
  column: { gap: Spacing.two },
  sortChip: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  footer: { textAlign: 'center', padding: Spacing.three },
});
