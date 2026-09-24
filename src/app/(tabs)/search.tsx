import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CatalogSkeleton,
  getCatalogColumnCount,
  ProductCard,
  resolveSearchPresentation,
} from '@/components/commerce';
import { EmptyState, ErrorState } from '@/components/screen-state';
import { AppButton, AppSearchField, AppSurface, AppText, CatalogGrid, SelectableChip } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePaginationLock } from '@/hooks/use-pagination-lock';
import { screen, track } from '@/lib/analytics';
import { addRecentSearch, parseRecentSearches, RECENT_SEARCHES_STORAGE_KEY, serializeRecentSearches } from '@/lib/recent-searches';
import { usePredictiveSearch, useSearchProducts } from '@/shopify/hooks';

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = getCatalogColumnCount(width);
  const [draftQuery, setDraftQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debouncedDraft = useDebounced(draftQuery.trim());
  const predictive = usePredictiveSearch(debouncedDraft);
  const submitted = useSearchProducts(submittedQuery);
  const loadNextPage = usePaginationLock({
    hasNextPage: presentationModeCanPaginate(submittedQuery, submitted.hasNextPage),
    isFetchingNextPage: submitted.isFetchingNextPage,
    fetchNextPage: submitted.fetchNextPage,
  });

  useEffect(() => screen('Search'), []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setRecentSearches(parseRecentSearches(raw));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submittedProducts = useMemo(
    () => submitted.data?.pages.flatMap((page) => page.search.nodes) ?? [],
    [submitted.data],
  );
  const presentation = resolveSearchPresentation({
    draftQuery,
    submittedQuery,
    predictiveCount: predictive.data?.products.length ?? 0,
    submittedCount: submittedProducts.length,
    submittedPending: submitted.isFetching && !submitted.data,
  });
  const displayProducts =
    presentation.mode === 'suggestions'
      ? (predictive.data?.products ?? [])
      : presentation.mode === 'results'
        ? submittedProducts
        : [];

  const submitSearch = (value = draftQuery) => {
    const query = value.trim();
    if (query.length < 2) return;
    setDraftQuery(query);
    setSubmittedQuery(query);
    track('search', { query });
    setRecentSearches((current) => {
      const next = addRecentSearch(current, query);
      void AsyncStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, serializeRecentSearches(next)).catch(() => {});
      return next;
    });
  };

  const clearSearch = () => {
    setDraftQuery('');
    setSubmittedQuery('');
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    void AsyncStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY).catch(() => {});
  };

  const firstPageError =
    presentation.mode === 'suggestions'
      ? predictive.isError
      : submitted.isError && submittedProducts.length === 0;

  return (
    <AppSurface style={[styles.container, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.searchBar}>
        <View style={styles.searchField}>
          <AppSearchField
            accessibilityLabel="Search products"
            value={draftQuery}
            onChangeText={setDraftQuery}
            onSubmitEditing={() => submitSearch()}
            placeholder="Search products"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
        {draftQuery ? <AppButton label="Clear" variant="tertiary" onPress={clearSearch} /> : null}
      </View>

      <CatalogGrid
        key={`search-${columns}`}
        columns={columns}
        data={displayProducts}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (presentation.mode === 'results') void loadNextPage();
        }}
        ListHeaderComponent={
          <SearchHeader
            mode={presentation.mode}
            query={presentation.query}
            count={presentation.count}
            predictive={predictive.data}
            onSubmitSuggestion={submitSearch}
          />
        }
        ListEmptyComponent={
          firstPageError ? (
            <ErrorState
              message="Search is unavailable right now."
              onRetry={() =>
                presentation.mode === 'suggestions' ? predictive.refetch() : submitted.refetch()
              }
            />
          ) : presentation.mode === 'loading-results' || predictive.isFetching ? (
            <CatalogSkeleton label="Loading search results" />
          ) : presentation.mode === 'empty-results' ? (
            <EmptyState title="No matches" subtitle={`Nothing found for “${presentation.query}”.`} />
          ) : presentation.mode === 'idle' ? (
            <View style={styles.idle}>
              {recentSearches.length ? (
                <View style={styles.recentSearches}>
                  <View style={styles.recentHeader}>
                    <AppText variant="labelStrong">Recent searches</AppText>
                    <AppButton label="Clear" variant="tertiary" onPress={clearRecentSearches} />
                  </View>
                  <View style={styles.suggestions}>
                    {recentSearches.map((query) => (
                      <SelectableChip key={query} label={query} onPress={() => submitSearch(query)} />
                    ))}
                  </View>
                </View>
              ) : null}
              <EmptyState title="Search the catalog" subtitle="Enter at least two characters, then submit for full results." />
            </View>
          ) : (
            <EmptyState title="No suggestions yet" subtitle="Submit your search to check the full catalog." />
          )
        }
        ListFooterComponent={
          presentation.mode === 'results' && submitted.isFetchNextPageError ? (
            <View style={styles.paginationError}>
              <AppText variant="caption" tone="textSecondary">Couldn’t load more results.</AppText>
              <AppButton label="Try again" variant="secondary" onPress={() => void loadNextPage()} />
            </View>
          ) : presentation.mode === 'results' && submitted.isFetchingNextPage ? (
            <CatalogSkeleton label="Loading more search results" />
          ) : null
        }
        renderItem={({ item }) => <ProductCard product={item} />}
      />
    </AppSurface>
  );
}

function presentationModeCanPaginate(submittedQuery: string, hasNextPage: boolean | undefined) {
  return submittedQuery.length >= 2 && Boolean(hasNextPage);
}

function SearchHeader({
  mode,
  query,
  count,
  predictive,
  onSubmitSuggestion,
}: {
  mode: ReturnType<typeof resolveSearchPresentation>['mode'];
  query: string;
  count: number;
  predictive: ReturnType<typeof usePredictiveSearch>['data'];
  onSubmitSuggestion: (query: string) => void;
}) {
  if (mode === 'idle') return null;
  if (mode === 'results' || mode === 'empty-results' || mode === 'loading-results') {
    return (
      <View style={styles.header}>
        <AppText variant="heading">Results for “{query}”</AppText>
        {mode !== 'loading-results' ? (
          <AppText variant="caption" tone="textSecondary">{count} loaded {count === 1 ? 'result' : 'results'}</AppText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <AppText variant="heading">Suggestions</AppText>
      {predictive?.queries.length ? (
        <View style={styles.suggestions}>
          {predictive.queries.map((suggestion) => (
            <SelectableChip
              key={suggestion.text}
              label={suggestion.text}
              onPress={() => onSubmitSuggestion(suggestion.text)}
            />
          ))}
        </View>
      ) : null}
      {predictive?.collections.length ? (
        <View style={styles.collections}>
          <AppText variant="labelStrong">Collections</AppText>
          {predictive.collections.map((collection) => (
            <Link key={collection.id} href={`/collection/${collection.handle}`} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={collection.title}
                style={styles.collectionLink}>
                <AppText>{collection.title}</AppText>
                <AppText tone="textSecondary">›</AppText>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}
      <AppText variant="labelStrong">Products</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 0 },
  searchBar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  searchField: { flex: 1 },
  list: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.two, paddingBottom: Spacing.six },
  row: { alignItems: 'stretch' },
  header: { gap: Spacing.two, padding: Spacing.one, paddingBottom: Spacing.three },
  idle: { gap: Spacing.four },
  recentSearches: { gap: Spacing.two, padding: Spacing.two },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  collections: { gap: Spacing.one },
  collectionLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paginationError: { alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
});
