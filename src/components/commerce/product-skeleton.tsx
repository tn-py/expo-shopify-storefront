import { StyleSheet, View } from 'react-native';

import { AppSurface } from '@/components/ui/app-surface';
import { AppText } from '@/components/ui/app-text';
import { Price } from '@/components/ui/price';
import { RemoteImage } from '@/components/ui/remote-image';
import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import type { ProductCard as ProductCardData } from '@/shopify/types';

/**
 * Instant PDP layout: when `ProductCard.onPressIn` seeded a lightweight card
 * snapshot into the query cache, this renders that snapshot's image/title/
 * vendor/price immediately, with skeleton placeholders standing in for the
 * option/description content that still needs the full product query.
 * Without a snapshot, everything is a skeleton placeholder.
 */
export function ProductSkeleton({ snapshot }: { snapshot: ProductCardData | null }) {
  const price = snapshot?.priceRange.minVariantPrice;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading product"
      accessibilityState={{ busy: true }}
      style={styles.container}>
      <View style={styles.gallery}>
        <RemoteImage
          uri={snapshot?.featuredImage?.url}
          alt={snapshot?.featuredImage?.altText ?? snapshot?.title ?? 'Loading product image'}
          contentFit="contain"
          style={styles.image}
        />
      </View>
      <View style={styles.body}>
        {snapshot?.vendor ? (
          <AppText variant="captionStrong" tone="textSecondary">{snapshot.vendor}</AppText>
        ) : (
          <AppSurface variant="muted" style={styles.lineShort} />
        )}
        {snapshot?.title ? (
          <AppText variant="title">{snapshot.title}</AppText>
        ) : (
          <AppSurface variant="muted" style={styles.lineTitle} />
        )}
        {price ? (
          <Price amount={price.amount} currencyCode={price.currencyCode} />
        ) : (
          <AppSurface variant="muted" style={styles.lineShort} />
        )}
        {price ? null : (
          // Keeps the skeleton's price line visually distinct from a real one.
          <AppText style={styles.hidden}>{formatMoney(undefined)}</AppText>
        )}
        <View style={styles.optionsSkeleton}>
          <AppSurface variant="muted" style={styles.chip} />
          <AppSurface variant="muted" style={styles.chip} />
          <AppSurface variant="muted" style={styles.chip} />
        </View>
        <AppSurface variant="muted" style={styles.lineFull} />
        <AppSurface variant="muted" style={styles.lineFull} />
        <AppSurface variant="muted" style={styles.lineShort} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gallery: { aspectRatio: 1, paddingHorizontal: Spacing.two },
  image: { flex: 1, borderRadius: 14 },
  body: { gap: Spacing.two, padding: Spacing.three },
  lineShort: { width: 96, height: 16, borderRadius: 6 },
  lineTitle: { width: '70%', height: 28, borderRadius: 8 },
  lineFull: { width: '100%', height: 14, borderRadius: 6 },
  optionsSkeleton: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  chip: { width: 64, height: 36, borderRadius: 999 },
  hidden: { position: 'absolute', opacity: 0, height: 0, width: 0 },
});
