import { Alert } from 'heroui-native/alert';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { AppButton } from './app-button';

export type AppToastProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * This app-owned "toast" is intentionally inline and recoverable rather than
 * ephemeral; HeroUI Alert supplies the matching persistent feedback semantics.
 */
export function AppToast({ message, actionLabel, onAction }: AppToastProps) {
  return (
    <Alert
      status="default"
      accessible={false}
      role="none"
      className="bg-surface-secondary"
      style={styles.root}>
      <Alert.Content>
        <Alert.Description
          accessible
          role="alert"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {message}
        </Alert.Description>
        {actionLabel && onAction ? (
          <AppButton label={actionLabel} variant="secondary" onPress={onAction} />
        ) : null}
      </Alert.Content>
    </Alert>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two, padding: Spacing.three },
});
