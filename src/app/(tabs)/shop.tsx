import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState, ErrorState, LoadingState } from '@/components/screen-state';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCollections } from '@/shopify/hooks';

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { data, isPending, isError, error, refetch, isRefetching } = useCollections();

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  if (!data?.length) return <EmptyState title="No categories yet" />;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(c) => c.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.three,
          paddingBottom: Spacing.six,
        }}
        ListHeaderComponent={
          <ThemedText type="title" style={styles.title}>
            Shop
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Link href={`/collection/${item.handle}`} asChild>
            <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image.url }}
                    style={{ flex: 1 }}
                    contentFit="cover"
                  />
                ) : null}
              </View>
              <View style={styles.rowText}>
                <ThemedText numberOfLines={1}>{item.title}</ThemedText>
                {item.description ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                    {item.description}
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
          </Link>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { paddingHorizontal: Spacing.three, marginBottom: Spacing.three },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  thumb: { width: 64, height: 64, borderRadius: Spacing.two, overflow: 'hidden' },
  rowText: { flex: 1, gap: 2 },
});
