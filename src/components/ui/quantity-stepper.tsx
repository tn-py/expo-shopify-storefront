import { Button } from 'heroui-native/button';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';

export type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  busy?: boolean;
  onChange: (value: number) => void;
};

/**
 * HeroUI Native has no quantity-stepper behavior, so the app owns the
 * adjustable contract while each interactive control is a granular Button.
 */
export function QuantityStepper({ value, min = 1, max, disabled = false, busy = false, onChange }: QuantityStepperProps) {
  const decreaseDisabled = disabled || value <= min;
  const increaseDisabled = disabled || (max != null && value >= max);

  return (
    <View accessibilityRole="adjustable" accessibilityState={{ busy, disabled }} accessibilityValue={{ now: value, min, max }} style={styles.root}>
      <Button
        variant="secondary"
        size="sm"
        isIconOnly
        isDisabled={decreaseDisabled}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        accessibilityState={{ disabled: decreaseDisabled }}
        onPress={() => onChange(value - 1)}
        className="min-h-11 min-w-11 rounded-full"
        style={styles.control}>
        <Button.Label>−</Button.Label>
      </Button>
      <AppText accessibilityLabel={`Quantity ${value}`} variant="labelStrong" style={styles.value}>{value}</AppText>
      <Button
        variant="secondary"
        size="sm"
        isIconOnly
        isDisabled={increaseDisabled}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        accessibilityState={{ disabled: increaseDisabled }}
        onPress={() => onChange(value + 1)}
        className="min-h-11 min-w-11 rounded-full"
        style={styles.control}>
        <Button.Label>+</Button.Label>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  control: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  value: { minWidth: 24, textAlign: 'center' },
});
