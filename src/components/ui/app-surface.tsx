import { Surface } from 'heroui-native/surface';
import { StyleSheet, type ViewProps } from 'react-native';

export type AppSurfaceProps = ViewProps & {
  variant?: 'base' | 'raised' | 'muted';
};

const heroVariant = {
  base: 'default',
  raised: 'default',
  muted: 'secondary',
} as const;

const semanticClassName = {
  base: 'bg-surface',
  raised: 'bg-surface shadow-surface',
  muted: 'bg-surface-secondary',
} as const;

export function AppSurface({ variant = 'base', className, style, ...props }: AppSurfaceProps) {
  return (
    <Surface
      variant={heroVariant[variant]}
      className={[semanticClassName[variant], className].filter(Boolean).join(' ')}
      style={[styles.surface, variant === 'raised' && styles.raised, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: 14 },
  raised: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
