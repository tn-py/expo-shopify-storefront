import { Chip } from 'heroui-native/chip';
import { StyleSheet } from 'react-native';

export type StatusBadgeProps = { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' };

const color = {
  neutral: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const;

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <Chip
      accessible
      accessibilityLabel={label}
      color={color[tone]}
      variant="soft"
      size="sm"
      className="self-start"
      style={styles.root}>
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
});
