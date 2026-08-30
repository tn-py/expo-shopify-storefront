import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function StickyActionBar({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.root, { backgroundColor: theme.background, borderTopColor: theme.border }, style]} {...props} />;
}

const styles = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12 },
});
