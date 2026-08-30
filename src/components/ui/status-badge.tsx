import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/hooks/use-theme';

export type StatusBadgeProps = { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' };

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.sale : tone === 'success' ? '#16803c' : tone === 'warning' ? '#9a6700' : theme.textSecondary;
  return <View accessibilityLabel={label} style={[styles.root, { backgroundColor: theme.backgroundElement }]}><AppText variant="caption" style={{ color }}>{label}</AppText></View>;
}

const styles = StyleSheet.create({ root: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 } });
