import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { AppSurface } from '@/components/ui/app-surface';
import { Price } from '@/components/ui/price';
import { RemoteImage } from '@/components/ui/remote-image';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { formatMoney, isOnSale } from '@/lib/format';
import { productQueryOptions } from '@/shopify/hooks';
import type { ProductCard as ProductCardData } from '@/shopify/types';
import { WishlistButton } from './wishlist-button';

export function ProductCard({ product }: { product: ProductCardData }) {
  const queryClient = useQueryClient();
  const price = product.priceRange.minVariantPrice;
  const maxPrice = product.priceRange.maxVariantPrice;
  const compareAt = product.compareAtPriceRange.minVariantPrice;
  const onSale = isOnSale(price, compareAt);
  const variablePrice = price.amount !== maxPrice.amount;
  const accessibilityLabel = [
    product.title,
    variablePrice ? `from ${formatMoney(price)}` : formatMoney(price),
    onSale ? 'on sale' : null,
    product.availableForSale ? null : 'sold out',
  ]
    .filter(Boolean)
    .join(', ');

  const prefetch = () => {
    // Seeds the lightweight card snapshot immediately (so the PDP can render
    // instantly) and starts loading the full product in the background.
    queryClient.setQueryData(['productCard', product.handle], product);
    void queryClient.prefetchQuery(productQueryOptions(product.handle));
  };

  return (
    <View style={styles.wrapper}>
      <Link href={`/product/${product.handle}`} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={accessibilityLabel}
          onPressIn={prefetch}
          style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
          <AppSurface variant="raised" style={styles.card}>
            <View style={styles.imageWrap}>
              <RemoteImage
                uri={product.featuredImage?.url}
                alt={product.featuredImage?.altText ?? product.title}
                contentFit="contain"
                style={styles.image}
              />
              {onSale ? (
                <View style={styles.badge}>
                  <StatusBadge label="Sale" tone="danger" />
                </View>
              ) : !product.availableForSale ? (
                <View style={styles.badge}>
                  <StatusBadge label="Sold out" />
                </View>
              ) : null}
            </View>
            <View style={styles.body}>
              {product.vendor ? (
                <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
                  {product.vendor}
                </AppText>
              ) : null}
              <AppText variant="labelStrong" numberOfLines={2} style={styles.title}>
                {product.title}
              </AppText>
              {variablePrice ? (
                <AppText variant="price">From {formatMoney(price)}</AppText>
              ) : (
                <Price
                  amount={price.amount}
                  currencyCode={price.currencyCode}
                  compareAtAmount={onSale ? compareAt.amount : null}
                />
              )}
            </View>
          </AppSurface>
        </Pressable>
      </Link>
      {/* A sibling pressable (not nested in the Link above) so the heart
          toggle doesn't also trigger navigation. */}
      <WishlistButton product={product} size={18} overlay style={styles.heart} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, position: 'relative' },
  pressable: { flex: 1, minHeight: 44, padding: Spacing.one },
  pressed: { opacity: 0.72 },
  card: { flex: 1, overflow: 'hidden' },
  imageWrap: { aspectRatio: 1 },
  image: { flex: 1 },
  badge: { position: 'absolute', left: Spacing.two, top: Spacing.two },
  body: { flex: 1, gap: Spacing.half, padding: Spacing.two },
  title: { minHeight: 40 },
  heart: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
  },
});
