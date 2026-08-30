import { Surface } from 'heroui-native/surface';
import { StyleSheet, type ViewProps } from 'react-native';

export function StickyActionBar({ className, style, ...props }: ViewProps) {
  return (
    <Surface
      variant="default"
      className={['border-t border-border bg-surface', className].filter(Boolean).join(' ')}
      style={[styles.root, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12 },
});
