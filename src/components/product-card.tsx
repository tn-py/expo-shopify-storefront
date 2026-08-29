import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, formatMoneyRange, isOnSale } from '@/lib/format';
import type { ProductCard as ProductCardData } from '@/shopify/types';

export function ProductCard({ product }: { product: ProductCardData }) {
  const theme = useTheme();
  const onSale = isOnSale(
    product.priceRange.minVariantPrice,
    product.compareAtPriceRange.minVariantPrice,
  );

  return (
    <Link href={`/product/${product.handle}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={[styles.imageWrap, { backgroundColor: theme.backgroundElement }]}>
          {product.featuredImage ? (
            <Image
              source={{ uri: product.featuredImage.url }}
              style={styles.image}
              contentFit="contain"
              transition={150}
              accessibilityLabel={product.featuredImage.altText ?? product.title}
            />
          ) : null}
          {onSale ? (
            <View style={styles.badge}>
              <ThemedText type="small" style={styles.badgeText}>
                Sale
              </ThemedText>
            </View>
          ) : null}
        </View>

        {product.vendor ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {product.vendor}
          </ThemedText>
        ) : null}
        <ThemedText type="small" numberOfLines={2} style={styles.title}>
          {product.title}
        </ThemedText>

        <View style={styles.priceRow}>
          <ThemedText type="smallBold">
            {formatMoneyRange(
              product.priceRange.minVariantPrice,
              product.priceRange.maxVariantPrice,
            )}
          </ThemedText>
          {onSale ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.strike}>
              {formatMoney(product.compareAtPriceRange.minVariantPrice)}
            </ThemedText>
          ) : null}
        </View>

        {!product.availableForSale ? (
          <ThemedText type="small" themeColor="textSecondary">
            Sold out
          </ThemedText>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: Spacing.half, padding: Spacing.two },
  pressed: { opacity: 0.7 },
  imageWrap: {
    aspectRatio: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    marginBottom: Spacing.one,
  },
  image: { flex: 1 },
  title: { minHeight: 40 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  strike: { textDecorationLine: 'line-through' },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    backgroundColor: Brand.sale,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.one,
  },
  badgeText: { color: '#fff', fontFamily: Fonts.bold },
});
