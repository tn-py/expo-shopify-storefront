import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  loading?: boolean;
};

export function AppButton({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  ...props
}: AppButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const isSolid = variant === 'primary' || variant === 'danger';
  const backgroundColor =
    variant === 'danger' ? theme.sale : variant === 'primary' ? theme.primary : theme.backgroundElement;
  const color = isSolid ? theme.onPrimary : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: isDisabled ? 0.5 : pressed ? 0.82 : 1 },
      ]}
      {...props}>
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.label, { color }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  label: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20 },
});
