import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function QuantityStepper({ value, min = 1, max, disabled = false, onChange }: QuantityStepperProps) {
  const theme = useTheme();
  const decreaseDisabled = disabled || value <= min;
  const increaseDisabled = disabled || (max != null && value >= max);
  const controlStyle = [styles.control, { backgroundColor: theme.backgroundElement }];

  return (
    <View accessibilityRole="adjustable" accessibilityState={{ busy: disabled, disabled }} accessibilityValue={{ now: value, min, max }} style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        accessibilityState={{ disabled: decreaseDisabled }}
        disabled={decreaseDisabled}
        onPress={() => onChange(value - 1)}
        style={[controlStyle, decreaseDisabled && styles.disabled]}>
        <Text style={{ color: theme.text }}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`Quantity ${value}`} style={[styles.value, { color: theme.text }]}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        accessibilityState={{ disabled: increaseDisabled }}
        disabled={increaseDisabled}
        onPress={() => onChange(value + 1)}
        style={[controlStyle, increaseDisabled && styles.disabled]}>
        <Text style={{ color: theme.text }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  control: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  disabled: { opacity: 0.45 },
  value: { minWidth: 24, textAlign: 'center', fontFamily: Fonts.semibold },
});
