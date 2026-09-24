import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { ProductCard as ProductCardData } from '@/shopify/types';
import { useWishlist } from '@/wishlist/wishlist';

/**
 * Heart save/remove toggle, reused on `ProductCard` (overlaid, as a sibling of
 * the card's own link-pressable) and next to Share in the PDP header.
 */
export function WishlistButton({
  product,
  size = 22,
  overlay = false,
  style,
}: {
  product: ProductCardData;
  size?: number;
  /** Adds a theme-aware backdrop so the icon stays legible over product imagery. */
  overlay?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(product.handle);
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${product.title} from saved` : `Save ${product.title}`}
      accessibilityState={{ selected: saved }}
      hitSlop={8}
      onPress={() => toggle(product)}
      style={[styles.button, overlay && [styles.overlay, { backgroundColor: theme.background }], style]}>
      <Ionicons
        name={saved ? 'heart' : 'heart-outline'}
        size={size}
        color={saved ? theme.sale : theme.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  overlay: { borderRadius: 999, opacity: 0.92 },
});
