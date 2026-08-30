import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Spacing } from '@/constants/theme';

export type StateViewProps = {
  mode: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateView({ mode, title, message, actionLabel, onAction }: StateViewProps) {
  const resolvedTitle = title ?? (mode === 'loading' ? 'Loading' : mode === 'error' ? 'Something went wrong' : 'Nothing here yet');
  return (
    <View accessibilityRole="summary" style={styles.root}>
      {mode === 'loading' ? <ActivityIndicator /> : null}
      <AppText variant="heading">{resolvedTitle}</AppText>
      {message ? <AppText tone="textSecondary" style={styles.message}>{message}</AppText> : null}
      {actionLabel && onAction ? <AppButton label={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  message: { textAlign: 'center' },
});
