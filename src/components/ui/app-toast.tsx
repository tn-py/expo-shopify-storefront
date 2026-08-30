import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { AppButton } from './app-button';
import { AppSurface } from './app-surface';
import { AppText } from './app-text';

export type AppToastProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function AppToast({ message, actionLabel, onAction }: AppToastProps) {
  return (
    <View>
      <AppSurface variant="muted" style={styles.root}>
        <AppText accessible accessibilityRole="alert" style={styles.message}>{message}</AppText>
        {actionLabel && onAction ? (
          <AppButton label={actionLabel} variant="secondary" onPress={onAction} />
        ) : null}
      </AppSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two, padding: Spacing.three },
  message: { flexShrink: 1 },
});
