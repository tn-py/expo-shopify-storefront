import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/screen-state';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { usePredictiveSearch, useSearchProducts } from '@/shopify/hooks';

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim());
  const predictive = usePredictiveSearch(debounced);
  const productSearch = useSearchProducts(debounced);
  const tracked = useRef('');

  useEffect(() => {
    if (debounced.length >= 2 && debounced !== tracked.current) {
      tracked.current = debounced;
      track('search', { query: debounced });
    }
  }, [debounced]);

  // Prefer full-text search results (reliable); fall back to predictive hits.
  const searchProducts =
    productSearch.data?.pages.flatMap((p) => p.search.nodes) ?? [];
  const products = searchProducts.length
    ? searchProducts
    : (predictive.data?.products ?? []);
  const collections = predictive.data?.collections ?? [];
  const isFetching = predictive.isFetching || productSearch.isFetching;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search products"
        placeholderTextColor={theme.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text },
        ]}
      />

      {debounced.length < 2 ? (
        <EmptyState title="Search the catalog" subtitle="Find products by name" />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          keyboardShouldPersistTaps="handled"
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (productSearch.hasNextPage && !productSearch.isFetchingNextPage) {
              productSearch.fetchNextPage();
            }
          }}
          ListHeaderComponent={
            collections.length ? (
              <View style={styles.collections}>
                <ThemedText type="smallBold">Collections</ThemedText>
                {collections.map((c) => (
                  <Link key={c.id} href={`/collection/${c.handle}`} asChild>
                    <Pressable style={styles.collectionRow}>
                      <View
                        style={[styles.cThumb, { backgroundColor: theme.backgroundElement }]}>
                        {c.image ? (
                          <Image source={{ uri: c.image.url }} style={{ flex: 1 }} />
                        ) : null}
                      </View>
                      <ThemedText type="small">{c.title}</ThemedText>
                    </Pressable>
                  </Link>
                ))}
                <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>
                  Products
                </ThemedText>
              </View>
            ) : null
          }
          ListEmptyComponent={
            isFetching ? null : (
              <EmptyState title="No matches" subtitle={`Nothing found for “${debounced}”.`} />
            )
          }
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.two },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    marginHorizontal: Spacing.one,
  },
  list: { paddingVertical: Spacing.three, paddingBottom: Spacing.six },
  column: { gap: Spacing.two },
  collections: { gap: Spacing.two, paddingHorizontal: Spacing.one },
  collectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cThumb: { width: 40, height: 40, borderRadius: Spacing.one, overflow: 'hidden' },
});
