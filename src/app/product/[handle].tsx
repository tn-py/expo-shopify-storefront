import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getProductScrollBottomPadding,
  multiplyMoneyAmount,
  ProductOptionSelector,
  resolveVariantSelection,
  ServiceDisclosure,
} from '@/components/commerce';
import { ErrorState, LoadingState } from '@/components/screen-state';
import {
  AppButton,
  AppSurface,
  AppText,
  Price,
  QuantityStepper,
  RemoteImage,
  StateView,
  StatusBadge,
  StickyActionBar,
} from '@/components/ui';
import { storefrontUIConfig } from '@/config/storefront-ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { useCart } from '@/shopify/cart';
import { useProduct } from '@/shopify/hooks';
import type { ShopImage } from '@/shopify/types';

type AddFeedback =
  | { mode: 'idle' }
  | { mode: 'success'; message: string }
  | { mode: 'error'; message: string };

export default function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data: product, isPending, isError, error, refetch } = useProduct(handle ?? '');
  const { addLine, busy } = useCart();
  const [requestedSelection, setRequestedSelection] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [stickyActionHeight, setStickyActionHeight] = useState(0);
  const [feedback, setFeedback] = useState<AddFeedback>({ mode: 'idle' });

  const resolved = useMemo(
    () =>
      product
        ? resolveVariantSelection(product, requestedSelection)
        : { selection: {}, variant: null },
    [product, requestedSelection],
  );
  const gallery = useMemo(() => {
    if (!product) return [];
    const images = [resolved.variant?.image, ...product.images.nodes, product.featuredImage].filter(
      (image): image is ShopImage => Boolean(image),
    );
    return Array.from(new Map(images.map((image) => [image.url, image])).values());
  }, [product, resolved.variant?.image]);

  const productHandle = product?.handle;
  const productTitle = product?.title;

  useEffect(() => {
    if (productHandle) track('product_viewed', { handle: productHandle, title: productTitle });
  }, [productHandle, productTitle]);

  if (isPending) return <LoadingState label="Loading product…" />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  if (!product) {
    return (
      <StateView
        mode="empty"
        title="Product not found"
        message="This product may have moved or is no longer available."
      />
    );
  }

  const variant = resolved.variant;
  const price = variant?.price ?? product.priceRange.minVariantPrice;
  const compareAt = variant?.compareAtPrice;
  const totalAmount = multiplyMoneyAmount(price.amount, quantity);
  const totalCompareAtAmount = compareAt
    ? multiplyMoneyAmount(compareAt.amount, quantity)
    : undefined;
  const soldOut = !variant?.availableForSale;
  const savings = compareAt ? Number(compareAt.amount) - Number(price.amount) : 0;
  const savingsPercent = compareAt && savings > 0
    ? Math.round((savings / Number(compareAt.amount)) * 100)
    : 0;
  const galleryWidth = Math.min(width >= 700 ? width * 0.58 : width, 620);

  const changeOption = (optionName: string, value: string) => {
    const next = resolveVariantSelection(product, {
      ...resolved.selection,
      [optionName]: value,
    });
    setRequestedSelection(next.selection);
    setFeedback({ mode: 'idle' });
  };

  const addToCart = async () => {
    if (!variant?.availableForSale) return;
    setFeedback({ mode: 'idle' });
    try {
      await addLine(variant.id, quantity);
      track('add_to_cart', {
        variantId: variant.id,
        title: product.title,
        quantity,
      });
      setFeedback({
        mode: 'success',
        message: `${quantity} ${quantity === 1 ? 'item' : 'items'} added to your cart.`,
      });
    } catch {
      setFeedback({
        mode: 'error',
        message: 'We couldn’t add this item. Your selection is still here—please try again.',
      });
    }
  };

  return (
    <AppSurface style={styles.container}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: getProductScrollBottomPadding(stickyActionHeight) },
        ]}>
        <ScrollView
          horizontal
          pagingEnabled={width < 700}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gallery}
          accessibilityLabel={`Product gallery, ${Math.max(gallery.length, 1)} images`}>
          {gallery.length ? gallery.map((image, index) => (
            <AppSurface
              key={image.url}
              variant="muted"
              style={[styles.galleryItem, { width: galleryWidth }]}>
              <RemoteImage
                uri={image.url}
                alt={image.altText ?? `${product.title}, image ${index + 1}`}
                contentFit="contain"
                style={styles.galleryImage}
              />
              <AppText variant="caption" tone="textSecondary" style={styles.imageCount}>
                {index + 1} / {gallery.length}
              </AppText>
            </AppSurface>
          )) : (
            <AppSurface variant="muted" style={[styles.galleryItem, { width: galleryWidth }]}>
              <RemoteImage uri={null} alt={product.title} style={styles.galleryImage} />
            </AppSurface>
          )}
        </ScrollView>

        <View style={styles.body}>
          <View style={styles.identity}>
            {product.vendor ? <AppText variant="captionStrong" tone="textSecondary">{product.vendor}</AppText> : null}
            <AppText variant="title">{product.title}</AppText>
            <View style={styles.priceAndStock}>
              <Price
                amount={price.amount}
                currencyCode={price.currencyCode}
                compareAtAmount={compareAt?.amount}
              />
              <StatusBadge
                label={soldOut ? 'Sold out' : 'In stock'}
                tone={soldOut ? 'neutral' : 'success'}
              />
            </View>
            {savingsPercent > 0 ? (
              <AppText variant="captionStrong" tone="sale">
                Save {savingsPercent}%
              </AppText>
            ) : null}
            {variant?.sku ? <AppText variant="caption" tone="textSecondary">SKU {variant.sku}</AppText> : null}
          </View>

          <ProductOptionSelector
            product={product}
            selection={resolved.selection}
            onChange={changeOption}
          />

          <View style={styles.quantity}>
            <AppText variant="labelStrong">Quantity</AppText>
            <QuantityStepper
              value={quantity}
              min={1}
              onChange={(value) => {
                setQuantity(value);
                setFeedback({ mode: 'idle' });
              }}
            />
          </View>

          {feedback.mode !== 'idle' ? (
            <AppSurface
              accessibilityRole="alert"
              variant="muted"
              style={styles.feedback}>
              <AppText tone={feedback.mode === 'error' ? 'sale' : 'text'}>{feedback.message}</AppText>
              {feedback.mode === 'error' ? (
                <AppButton label="Try adding again" variant="secondary" onPress={addToCart} />
              ) : null}
            </AppSurface>
          ) : null}

          {product.description ? (
            <View style={styles.description}>
              <AppText variant="heading">Details</AppText>
              <AppText tone="textSecondary">{product.description}</AppText>
            </View>
          ) : null}

          <View style={styles.services}>
            {(storefrontUIConfig.product?.services ?? []).map((service) => (
              <ServiceDisclosure key={service.title} title={service.title} body={service.body} />
            ))}
          </View>
        </View>
      </ScrollView>

      <StickyActionBar
        onLayout={(event) => setStickyActionHeight(event.nativeEvent.layout.height)}
        style={{ paddingBottom: insets.bottom + Spacing.two }}>
        <View style={styles.stickyContent}>
          <View style={styles.stickyPrice}>
            <AppText variant="caption" tone="textSecondary">
              {quantity} {quantity === 1 ? 'item' : 'items'} total
            </AppText>
            <Price
              amount={totalAmount}
              currencyCode={price.currencyCode}
              compareAtAmount={totalCompareAtAmount}
            />
          </View>
          <View style={styles.stickyButton}>
            <AppButton
              label={soldOut ? 'Sold out' : 'Add to cart'}
              loading={busy}
              disabled={soldOut || !variant}
              onPress={addToCart}
            />
          </View>
        </View>
      </StickyActionBar>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 0 },
  scrollContent: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  gallery: { gap: Spacing.two, paddingHorizontal: Spacing.two },
  galleryItem: { aspectRatio: 1, overflow: 'hidden' },
  galleryImage: { flex: 1 },
  imageCount: { position: 'absolute', right: Spacing.two, bottom: Spacing.two },
  body: { gap: Spacing.four, padding: Spacing.three },
  identity: { gap: Spacing.one },
  priceAndStock: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  quantity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedback: { gap: Spacing.two, padding: Spacing.three },
  description: { gap: Spacing.two },
  services: { gap: Spacing.two },
  stickyContent: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stickyPrice: { flex: 1 },
  stickyButton: { flex: 1.4 },
});
