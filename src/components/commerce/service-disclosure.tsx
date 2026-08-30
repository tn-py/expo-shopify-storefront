import { Accordion } from 'heroui-native/accordion';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Spacing } from '@/constants/theme';

const DISCLOSURE_VALUE = 'details';

export function ServiceDisclosure({ title, body }: { title: string; body: string }) {
  const [value, setValue] = useState<string | undefined>();
  return (
    <Accordion
      selectionMode="single"
      variant="surface"
      hideSeparator
      value={value}
      onValueChange={setValue}
      className="rounded-xl bg-surface-secondary"
      style={styles.surface}>
      <Accordion.Item value={DISCLOSURE_VALUE}>
        <Accordion.Trigger accessibilityLabel={title} className="min-h-11 px-4">
          <View style={styles.heading}>
            <AppText variant="labelStrong">{title}</AppText>
            <Accordion.Indicator />
          </View>
        </Accordion.Trigger>
        <Accordion.Content className="px-4 pb-4">
          <AppText tone="textSecondary">{body}</AppText>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden' },
  heading: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
