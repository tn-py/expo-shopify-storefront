import { Button } from 'heroui-native/button';
import { useState } from 'react';
import {
  StyleSheet,
  type PressableProps,
} from 'react-native';

import { Fonts } from '@/constants/theme';

export type SelectableChipProps = Omit<PressableProps, 'children'> & {
  label: string;
  selected?: boolean;
};

export function SelectableChip({
  label,
  selected = false,
  disabled = false,
  style,
  className,
  accessibilityRole: _accessibilityRole,
  accessibilityState,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...props
}: SelectableChipProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isDisabled = Boolean(disabled);
  const callerStyle = typeof style === 'function' ? style({ pressed, hovered }) : style;
  return (
    <Button
      {...props}
      variant={selected ? 'primary' : 'secondary'}
      size="sm"
      isDisabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, selected, disabled: isDisabled }}
      className={[className, 'min-h-11 rounded-full px-4'].filter(Boolean).join(' ')}
      style={[callerStyle, styles.chip]}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}>
      <Button.Label style={styles.label}>{label}</Button.Label>
    </Button>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 16 },
  label: { fontFamily: Fonts.medium, fontSize: 14 },
});
