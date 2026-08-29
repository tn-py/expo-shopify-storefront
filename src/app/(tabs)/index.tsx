import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorState, LoadingState } from '@/components/screen-state';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCollections, useShop } from '@/shopify/hooks';
import type { CollectionCard } from '@/shopify/types';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const shop = useShop();
  const collections = useCollections();

  if (collections.isPending) return <LoadingState label="Loading store…" />;
  if (collections.isError) {
    return (
      <ErrorState
        message={(collections.error as Error).message}
        onRetry={() => collections.refetch()}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={collections.data}
        keyExtractor={(c) => c.id}
        numColumns={2}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.two,
          paddingHorizontal: Spacing.two,
          paddingBottom: Spacing.six,
        }}
        columnWrapperStyle={styles.column}
        refreshControl={
          <RefreshControl
            refreshing={collections.isRefetching}
            onRefresh={() => {
              collections.refetch();
              shop.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <StoreWordmark
              name={shop.data?.name}
              logoUrl={shop.data?.brand?.logo?.image?.url ?? null}
            />
            <Pressable
              onPress={() => router.push('/search')}
              style={[styles.searchStub, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Search products…
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Shop by category
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => <CategoryCard collection={item} />}
      />
    </ThemedView>
  );
}

/**
 * Renders the merchant's brand logo (set in Shopify admin → Settings → Brand)
 * when available, otherwise the store name as a text wordmark. Zero config.
 */
function StoreWordmark({
  name,
  logoUrl,
}: {
  name?: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={styles.logo}
        contentFit="contain"
        contentPosition="left"
        accessibilityLabel={name}
      />
    );
  }
  return (
    <ThemedText type="title" numberOfLines={1} style={styles.wordmark}>
      {name ?? ' '}
    </ThemedText>
  );
}

function CategoryCard({ collection }: { collection: CollectionCard }) {
  const theme = useTheme();
  return (
    <Link href={`/collection/${collection.handle}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
        <View style={[styles.cardImage, { backgroundColor: theme.backgroundElement }]}>
          {collection.image ? (
            <Image
              source={{ uri: collection.image.url }}
              style={{ flex: 1 }}
              contentFit="cover"
              transition={150}
            />
          ) : null}
        </View>
        <ThemedText type="small" numberOfLines={2}>
          {collection.title}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { gap: Spacing.two, paddingHorizontal: Spacing.two, paddingBottom: Spacing.three },
  logo: { width: 160, height: 44, marginTop: Spacing.one },
  wordmark: { marginTop: Spacing.one },
  searchStub: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
  },
  sectionTitle: { marginTop: Spacing.three },
  column: { gap: Spacing.two },
  card: { flex: 1, gap: Spacing.half, padding: Spacing.two },
  cardImage: {
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.one,
  },
});
