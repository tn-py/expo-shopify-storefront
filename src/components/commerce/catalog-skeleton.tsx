import { StyleSheet, View } from 'react-native';

import { AppSurface } from '@/components/ui/app-surface';
import { Spacing } from '@/constants/theme';

export function CatalogSkeleton({ label = 'Loading products' }: { label?: string }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={styles.grid}>
      {[0, 1, 2, 3].map((item) => (
        <AppSurface key={item} variant="muted" style={styles.card} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.two },
  card: { width: '48%', aspectRatio: 0.78, margin: '1%' },
});
