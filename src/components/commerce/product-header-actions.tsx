import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import type { ProductCard as ProductCardData } from '@/shopify/types';
import { WishlistButton } from './wishlist-button';

/** Wishlist + share row for the PDP header (`Stack.Screen options.headerRight`). */
export function ProductHeaderActions({
  product,
  shareUrl,
}: {
  product: ProductCardData;
  shareUrl: string;
}) {
  const theme = useTheme();

  const onShare = async () => {
    try {
      await Share.share({ message: shareUrl, url: shareUrl, title: product.title });
      track('share', { handle: product.handle });
    } catch {
      // The share sheet was dismissed or unavailable; nothing to recover.
    }
  };

  return (
    <View style={styles.row}>
      <WishlistButton product={product} size={20} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Share ${product.title}`}
        hitSlop={8}
        onPress={onShare}
        style={styles.button}>
        <Ionicons name="share-outline" size={20} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
