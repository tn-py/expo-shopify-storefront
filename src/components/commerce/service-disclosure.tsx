import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { AppSurface } from '@/components/ui/app-surface';
import { Spacing } from '@/constants/theme';

export function ServiceDisclosure({ title, body }: { title: string; body: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <AppSurface variant="muted" style={styles.surface}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.button}>
        <AppText variant="labelStrong">{title}</AppText>
        <AppText tone="textSecondary">{expanded ? '−' : '+'}</AppText>
      </Pressable>
      {expanded ? (
        <View style={styles.body}>
          <AppText tone="textSecondary">{body}</AppText>
        </View>
      ) : null}
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden' },
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  body: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
});
