import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type AppSurfaceProps = ViewProps & {
  variant?: 'base' | 'raised' | 'muted';
};

export function AppSurface({ variant = 'base', style, ...props }: AppSurfaceProps) {
  const theme = useTheme();
  const backgroundColor = variant === 'muted' ? theme.backgroundElement : theme.background;
  return <View style={[styles.surface, { backgroundColor }, variant === 'raised' && styles.raised, style]} {...props} />;
}

const styles = StyleSheet.create({
  surface: { borderRadius: 14 },
  raised: { elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});
