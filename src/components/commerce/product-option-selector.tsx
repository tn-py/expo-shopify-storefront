import { StyleSheet, View } from 'react-native';

import { getAvailableOptionValues } from '@/components/commerce/variant-selection';
import { AppText } from '@/components/ui/app-text';
import { SelectableChip } from '@/components/ui/selectable-chip';
import { Spacing } from '@/constants/theme';
import type { Product } from '@/shopify/types';

export function ProductOptionSelector({
  product,
  selection,
  onChange,
}: {
  product: Product;
  selection: Record<string, string>;
  onChange: (optionName: string, value: string) => void;
}) {
  return product.options
    .filter((option) => !(option.values.length === 1 && option.values[0] === 'Default Title'))
    .map((option) => {
      const availableValues = getAvailableOptionValues(product, selection, option.name);
      return (
        <View key={option.id} style={styles.option}>
          <AppText variant="labelStrong">{option.name}</AppText>
          <View style={styles.values}>
            {option.values.map((value) => (
              <SelectableChip
                key={value}
                label={value}
                selected={selection[option.name] === value}
                disabled={!availableValues.has(value)}
                onPress={() => onChange(option.name, value)}
              />
            ))}
          </View>
        </View>
      );
    });
}

const styles = StyleSheet.create({
  option: { gap: Spacing.two },
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
