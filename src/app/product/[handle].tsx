import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getProductScrollBottomPadding,
  multiplyMoneyAmount,
  ProductHeaderActions,
  ProductOptionSelector,
  ProductRecommendationsRail,
  ProductSkeleton,
  resolveVariantSelection,
  ServiceDisclosure,
} from '@/components/commerce';
import { ErrorState } from '@/components/screen-state';
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
import { hapticSelection, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { track } from '@/lib/analytics';
import { useCart } from '@/shopify/cart';
import { useProduct, useShop } from '@/shopify/hooks';
import type { ProductCard as ProductCardData, ShopImage } from '@/shopify/types';

type AddFeedback =
  | { mode: 'idle' }
  | { mode: 'success'; message: string }
  | { mode: 'error'; message: string };

export default function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { data: product, isPending, isError, error, refetch } = useProduct(handle ?? '');
  const shop = useShop();
  const { addLine, operations } = useCart();
  const addPending = operations.add?.pending ?? false;
  const [requestedSelection, setRequestedSelection] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [stickyActionHeight, setStickyActionHeight] = useState(0);
  const [feedback, setFeedback] = useState<AddFeedback>({ mode: 'idle' });
  const [galleryIndex, setGalleryIndex] = useState(0);

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

  if (isPending) {
    const snapshot = handle
      ? (queryClient.getQueryData<ProductCardData>(['productCard', handle]) ?? null)
      : null;
    return (
      <AppSurface style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <ProductSkeleton snapshot={snapshot} />
      </AppSurface>
    );
  }
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
  const shareUrl = shop.data?.primaryDomain?.url
    ? `${shop.data.primaryDomain.url}/products/${product.handle}`
    : product.title;

  const changeOption = (optionName: string, value: string) => {
    const next = resolveVariantSelection(product, {
      ...resolved.selection,
      [optionName]: value,
    });
    setRequestedSelection(next.selection);
    setFeedback({ mode: 'idle' });
    hapticSelection();
  };

  const onGalleryScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (gallery.length < 2) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / Math.max(galleryWidth, 1));
    setGalleryIndex(Math.min(Math.max(index, 0), gallery.length - 1));
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
      hapticSuccess();
      setFeedback({
        mode: 'success',
        message: `${quantity} ${quantity === 1 ? 'item' : 'items'} added to your cart.`,
      });
    } catch {
      hapticWarning();
      setFeedback({
        mode: 'error',
        message: 'We couldn’t add this item. Your selection is still here—please try again.',
      });
    }
  };

  return (
    <AppSurface style={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => <ProductHeaderActions product={product} shareUrl={shareUrl} />,
        }}
      />
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
          onMomentumScrollEnd={onGalleryScrollEnd}
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
            </AppSurface>
          )) : (
            <AppSurface variant="muted" style={[styles.galleryItem, { width: galleryWidth }]}>
              <RemoteImage uri={null} alt={product.title} style={styles.galleryImage} />
            </AppSurface>
          )}
        </ScrollView>
        {gallery.length > 1 ? (
          <View
            accessible
            accessibilityLabel={`Image ${galleryIndex + 1} of ${gallery.length}`}
            style={styles.galleryIndicator}>
            {gallery.map((image, index) => (
              <View
                key={image.url}
                style={[styles.dot, index === galleryIndex && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}

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
              {feedback.mode === 'success' ? (
                <AppButton label="View cart" variant="secondary" onPress={() => router.push('/cart')} />
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

        <ProductRecommendationsRail productId={product.id} excludeHandle={product.handle} />
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
              loading={addPending}
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
  galleryIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(120,120,128,0.36)' },
  dotActive: { backgroundColor: 'rgba(120,120,128,0.9)', width: 8, height: 8, borderRadius: 4 },
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
