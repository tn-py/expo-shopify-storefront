import { Spinner } from 'heroui-native/spinner';
import { Surface } from 'heroui-native/surface';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Spacing } from '@/constants/theme';

export type StateViewProps = {
  mode: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
};

export function StateView({
  mode,
  title,
  message,
  actionLabel,
  onAction,
  actionLoading = false,
}: StateViewProps) {
  const resolvedTitle = title ?? (mode === 'loading' ? 'Loading' : mode === 'error' ? 'Something went wrong' : 'Nothing here yet');
  return (
    <Surface
      variant="transparent"
      accessibilityRole="summary"
      className="flex-1 items-center justify-center gap-2 bg-transparent p-6"
      style={styles.root}>
      {mode === 'loading' ? <Spinner accessibilityLabel={resolvedTitle} /> : null}
      <AppText variant="heading">{resolvedTitle}</AppText>
      {message ? <AppText tone="textSecondary" style={styles.message}>{message}</AppText> : null}
      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          variant="secondary"
          loading={actionLoading}
          onPress={onAction}
        />
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  message: { textAlign: 'center' },
});
