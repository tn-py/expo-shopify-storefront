import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectableChipProps = Omit<PressableProps, 'children'> & {
  label: string;
  selected?: boolean;
};

export function SelectableChip({ label, selected = false, disabled = false, ...props }: SelectableChipProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: isDisabled }}
      disabled={isDisabled}
      style={[
        styles.chip,
        { backgroundColor: selected ? theme.primary : theme.backgroundElement, borderColor: theme.border },
        isDisabled && styles.disabled,
      ]}
      {...props}>
      <Text style={[styles.label, { color: selected ? theme.onPrimary : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 16 },
  label: { fontFamily: Fonts.medium, fontSize: 14 },
  disabled: { opacity: 0.45 },
});
