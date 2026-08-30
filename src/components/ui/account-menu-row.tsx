import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/hooks/use-theme';

export type AccountMenuRowProps = Omit<PressableProps, 'children'> & { label: string; detail?: string };

export function AccountMenuRow({ label, detail, disabled = false, ...props }: AccountMenuRowProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: isDisabled }} disabled={isDisabled} style={[styles.row, { borderBottomColor: theme.border }, isDisabled && styles.disabled]} {...props}>
      <View><AppText variant="label">{label}</AppText>{detail ? <AppText variant="caption" tone="textSecondary">{detail}</AppText> : null}</View>
      <AppText tone="textSecondary">›</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({ row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 }, disabled: { opacity: 0.45 } });
