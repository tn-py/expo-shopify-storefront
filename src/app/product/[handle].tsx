import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ErrorState, LoadingState } from '@/components/screen-state';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, isOnSale } from '@/lib/format';
import { track } from '@/lib/analytics';
import { useCart } from '@/shopify/cart';
import { useProduct } from '@/shopify/hooks';
import type { ProductVariant } from '@/shopify/types';

const { width } = Dimensions.get('window');

function matchVariant(
  variants: ProductVariant[],
  selection: Record<string, string>,
): ProductVariant | undefined {
  return variants.find((v) =>
    v.selectedOptions.every((o) => selection[o.name] === o.value),
  );
}

export default function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { data: product, isPending, isError, error, refetch } = useProduct(handle ?? '');
  const { addLine, busy } = useCart();

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  const defaultSelection = useMemo(
    () =>
      product
        ? Object.fromEntries(product.options.map((o) => [o.name, o.values[0]]))
        : {},
    [product],
  );
  const selection = useMemo(
    () => ({ ...defaultSelection, ...overrides }),
    [defaultSelection, overrides],
  );

  useEffect(() => {
    if (product) {
      track('product_viewed', { handle: product.handle, title: product.title });
    }
  }, [product]);

  const variant = useMemo(
    () => (product ? matchVariant(product.variants.nodes, selection) : undefined),
    [product, selection],
  );

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  if (!product) return <ErrorState message="Product not found" />;

  const price = variant?.price ?? product.priceRange.minVariantPrice;
  const compareAt = variant?.compareAtPrice ?? null;
  const onSale = isOnSale(price, compareAt);
  const soldOut = variant ? !variant.availableForSale : !product.availableForSale;

  const onAdd = async () => {
    if (!variant) return;
    await addLine(variant.id, 1);
    track('add_to_cart', { variantId: variant.id, title: product.title });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: Spacing.six }}>
        <FlatList
          data={
            product.images.nodes.length
              ? product.images.nodes
              : product.featuredImage
                ? [product.featuredImage]
                : []
          }
          keyExtractor={(img, i) => img.url + i}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.hero, { backgroundColor: theme.backgroundElement }]}>
              <Image source={{ uri: item.url }} style={styles.heroImage} contentFit="contain" />
            </View>
          )}
        />

        <View style={styles.body}>
          {product.vendor ? (
            <ThemedText type="small" themeColor="textSecondary">
              {product.vendor}
            </ThemedText>
          ) : null}
          <ThemedText type="subtitle">{product.title}</ThemedText>

          <View style={styles.priceRow}>
            <ThemedText type="title" style={styles.price}>
              {formatMoney(price)}
            </ThemedText>
            {onSale && compareAt ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.strike}>
                {formatMoney(compareAt)}
              </ThemedText>
            ) : null}
          </View>

          {product.options
            .filter((o) => !(o.values.length === 1 && o.values[0] === 'Default Title'))
            .map((option) => (
              <View key={option.id} style={styles.optionBlock}>
                <ThemedText type="smallBold">{option.name}</ThemedText>
                <View style={styles.optionValues}>
                  {option.values.map((value) => {
                    const selected = selection[option.name] === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() =>
                          setOverrides((s) => ({ ...s, [option.name]: value }))
                        }
                        style={[
                          styles.chip,
                          {
                            borderColor: selected ? theme.text : theme.backgroundSelected,
                            backgroundColor: selected
                              ? theme.backgroundSelected
                              : 'transparent',
                          },
                        ]}>
                        <ThemedText type="small">{value}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

          {product.description ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
              {product.description}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.two, backgroundColor: theme.background },
        ]}>
        <Pressable
          onPress={onAdd}
          disabled={soldOut || busy || !variant}
          style={[styles.addBtn, (soldOut || busy || !variant) && { opacity: 0.5 }]}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.addText}>
              {soldOut ? 'Sold out' : added ? 'Added ✓' : 'Add to cart'}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { width, aspectRatio: 1 },
  heroImage: { flex: 1 },
  body: { padding: Spacing.three, gap: Spacing.two },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  price: { fontSize: 28, lineHeight: 34 },
  strike: { textDecorationLine: 'line-through' },
  optionBlock: { marginTop: Spacing.two, gap: Spacing.two },
  optionValues: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  description: { marginTop: Spacing.three, lineHeight: 20 },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  addBtn: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  addText: { color: '#fff', fontFamily: Fonts.bold, fontSize: 16 },
});
