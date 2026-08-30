import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionCard, ProductCard } from '@/components/commerce';
import { ErrorState, LoadingState } from '@/components/screen-state';
import { AppButton, AppSurface, AppText, RemoteImage } from '@/components/ui';
import {
  resolveHomeSections,
  storefrontUIConfig,
  type ResolvedHomeSection,
  type StorefrontRoute,
} from '@/config/storefront-ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { screen } from '@/lib/analytics';
import { useCollections, useProducts, useShop } from '@/shopify/hooks';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shop = useShop();
  const collections = useCollections();
  const products = useProducts();

  useEffect(() => screen('Home'), []);

  const sections = useMemo(
    () =>
      resolveHomeSections(storefrontUIConfig, {
        collections: collections.data ?? [],
        products: products.data ?? [],
      }),
    [collections.data, products.data],
  );

  if ((collections.isPending || products.isPending) && !sections.length) {
    return <LoadingState label="Loading storefront…" />;
  }
  if (collections.isError && products.isError) {
    return (
      <ErrorState
        message="We couldn’t load the storefront. Please try again."
        onRetry={() => {
          collections.refetch();
          products.refetch();
        }}
      />
    );
  }

  const navigate = (href: StorefrontRoute) => router.push(href);

  return (
    <AppSurface style={styles.container}>
      <FlatList
        data={sections}
        keyExtractor={(section, index) => `${section.type}-${index}`}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.six },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={collections.isRefetching || products.isRefetching || shop.isRefetching}
            onRefresh={() => {
              collections.refetch();
              products.refetch();
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
              accessibilityRole="button"
              accessibilityLabel="Search catalog"
              onPress={() => router.push('/search')}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <AppSurface variant="muted" style={styles.search}>
                <AppText tone="textSecondary">Search products…</AppText>
              </AppSurface>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <HomeSection section={item} onNavigate={navigate} />}
      />
    </AppSurface>
  );
}

function StoreWordmark({ name, logoUrl }: { name?: string; logoUrl: string | null }) {
  if (logoUrl) {
    return <RemoteImage uri={logoUrl} alt={name ?? 'Store logo'} contentFit="contain" style={styles.logo} />;
  }
  return <AppText variant="title" numberOfLines={1}>{name ?? 'Shop'}</AppText>;
}

function HomeSection({
  section,
  onNavigate,
}: {
  section: ResolvedHomeSection;
  onNavigate: (href: StorefrontRoute) => void;
}) {
  if (section.type === 'announcement') {
    return (
      <AppSurface variant="muted" style={styles.announcement}>
        <AppText variant="captionStrong" style={styles.centered}>{section.text}</AppText>
      </AppSurface>
    );
  }
  if (section.type === 'hero') {
    return (
      <AppSurface variant="raised" style={styles.hero}>
        {section.imageUrl ? (
          <RemoteImage uri={section.imageUrl} alt={section.title} style={styles.heroImage} />
        ) : null}
        <View style={styles.heroCopy}>
          <AppText variant="title">{section.title}</AppText>
          {section.body ? <AppText tone="textSecondary">{section.body}</AppText> : null}
          {section.action ? (
            <AppButton
              label={section.action.label}
              onPress={() => onNavigate(section.action!.href)}
            />
          ) : null}
        </View>
      </AppSurface>
    );
  }
  if (section.type === 'collections') {
    return (
      <View style={styles.section}>
        <AppText variant="heading" style={styles.sectionTitle}>{section.title}</AppText>
        <FlatList
          horizontal
          data={section.collections}
          keyExtractor={(collection) => collection.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item }) => <View style={styles.collectionItem}><CollectionCard collection={item} /></View>}
        />
      </View>
    );
  }
  if (section.type === 'products') {
    return (
      <View style={styles.section}>
        <AppText variant="heading" style={styles.sectionTitle}>{section.title}</AppText>
        <FlatList
          horizontal
          data={section.products}
          keyExtractor={(product) => product.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item }) => <View style={styles.productItem}><ProductCard product={item} /></View>}
        />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {section.title ? <AppText variant="heading" style={styles.sectionTitle}>{section.title}</AppText> : null}
      <View style={styles.trustGrid}>
        {section.items.map((item) => (
          <AppSurface key={item.title} variant="muted" style={styles.trustItem}>
            <AppText variant="labelStrong">{item.title}</AppText>
            {item.body ? <AppText variant="caption" tone="textSecondary">{item.body}</AppText> : null}
          </AppSurface>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 0 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four },
  header: { gap: Spacing.three, paddingHorizontal: Spacing.three },
  logo: { width: 180, height: 44 },
  search: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three },
  pressed: { opacity: 0.72 },
  section: { gap: Spacing.two },
  sectionTitle: { paddingHorizontal: Spacing.three },
  announcement: { marginHorizontal: Spacing.three, padding: Spacing.two },
  centered: { textAlign: 'center' },
  hero: { marginHorizontal: Spacing.three, overflow: 'hidden' },
  heroImage: { width: '100%', aspectRatio: 16 / 9 },
  heroCopy: { gap: Spacing.two, padding: Spacing.four },
  rail: { paddingHorizontal: Spacing.two },
  collectionItem: { width: 260 },
  productItem: { width: 190 },
  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.two },
  trustItem: { width: '48%', minWidth: 150, gap: Spacing.one, margin: '1%', padding: Spacing.three },
});
