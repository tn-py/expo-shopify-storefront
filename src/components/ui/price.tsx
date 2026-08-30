import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';

export type PriceProps = {
  amount: string | number;
  currencyCode: string;
  compareAtAmount?: string | number | null;
};

function formatPrice(amount: string | number, currencyCode: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(Number(amount));
}

export function Price({ amount, currencyCode, compareAtAmount }: PriceProps) {
  const sale = compareAtAmount != null && Number(compareAtAmount) > Number(amount);
  return (
    <View accessibilityLabel={sale ? `${formatPrice(amount, currencyCode)}, on sale from ${formatPrice(compareAtAmount, currencyCode)}` : formatPrice(amount, currencyCode)} style={styles.root}>
      <AppText variant="price" tone={sale ? 'sale' : 'text'}>{formatPrice(amount, currencyCode)}</AppText>
      {sale ? <AppText variant="caption" tone="textSecondary" style={styles.compareAt}>{formatPrice(compareAtAmount, currencyCode)}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flexDirection: 'row', alignItems: 'baseline', gap: 6 }, compareAt: { textDecorationLine: 'line-through' } });
