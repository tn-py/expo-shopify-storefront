import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Spacing } from '@/constants/theme';
import { useProductRecommendations } from '@/shopify/hooks';
import type { ProductCard as ProductCardData } from '@/shopify/types';
import { ProductCard } from './product-card';

/**
 * PDP "You may also like" rail. Hidden entirely while loading, on error, or
 * once the current product is excluded and nothing related is left — a
 * failed recommendations request should never block or clutter the PDP.
 */
export function ProductRecommendationsRail({
  productId,
  excludeHandle,
}: {
  productId: string | undefined;
  excludeHandle: string;
}) {
  const { data, isPending, isError } = useProductRecommendations(productId);
  const products = (data ?? []).filter((product) => product.handle !== excludeHandle);

  if (isPending || isError || products.length === 0) return null;

  return (
    <View style={styles.section}>
      <AppText variant="heading" style={styles.title}>You may also like</AppText>
      <FlatList
        horizontal
        data={products}
        keyExtractor={(product: ProductCardData) => product.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <ProductCard product={item} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  title: { paddingHorizontal: Spacing.three },
  rail: { paddingHorizontal: Spacing.two },
  item: { width: 190 },
});
