import { Button } from 'heroui-native/button';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  type PressableProps,
} from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AppButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  loading?: boolean;
};

const heroVariant = {
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  danger: 'danger',
} as const;

export function AppButton({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityRole: _accessibilityRole,
  accessibilityState,
  role: _role,
  'aria-busy': _ariaBusy,
  'aria-disabled': _ariaDisabled,
  className,
  style,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...props
}: AppButtonProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const theme = useTheme();
  const isDisabled = Boolean(disabled || loading);
  const indicatorColor = variant === 'primary' || variant === 'danger'
    ? theme.onPrimary
    : theme.text;
  const callerStyle = typeof style === 'function' ? style({ pressed, hovered }) : style;

  return (
    <Button
      {...props}
      variant={heroVariant[variant]}
      isDisabled={isDisabled}
      role="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={[className, 'min-h-11 rounded-xl px-4'].filter(Boolean).join(' ')}
      style={[callerStyle, styles.button]}
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
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <Button.Label style={styles.label}>{label}</Button.Label>
      )}
    </Button>
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
