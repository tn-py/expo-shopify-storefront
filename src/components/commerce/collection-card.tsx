import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { AppSurface } from '@/components/ui/app-surface';
import { RemoteImage } from '@/components/ui/remote-image';
import { Spacing } from '@/constants/theme';
import type { CollectionCard as CollectionCardData } from '@/shopify/types';

export function CollectionCard({ collection }: { collection: CollectionCardData }) {
  return (
    <Link href={`/collection/${collection.handle}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={collection.title}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        <AppSurface variant="raised" style={styles.card}>
          <RemoteImage
            uri={collection.image?.url}
            alt={collection.image?.altText ?? collection.title}
            style={styles.image}
          />
          <View style={styles.body}>
            <AppText variant="labelStrong">{collection.title}</AppText>
            {collection.description ? (
              <AppText variant="caption" tone="textSecondary" numberOfLines={3}>
                {collection.description}
              </AppText>
            ) : null}
          </View>
        </AppSurface>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  pressable: { flex: 1, minHeight: 44, padding: Spacing.one },
  pressed: { opacity: 0.72 },
  card: { flex: 1, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 4 / 3 },
  body: { gap: Spacing.one, padding: Spacing.two },
});
