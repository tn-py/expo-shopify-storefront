import { Accordion } from 'heroui-native/accordion';
import { PropsWithChildren, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Spacing } from '@/constants/theme';

const COLLAPSIBLE_VALUE = 'content';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [value, setValue] = useState<string | undefined>();
  return (
    <Accordion
      selectionMode="single"
      variant="surface"
      hideSeparator
      value={value}
      onValueChange={setValue}>
      <Accordion.Item value={COLLAPSIBLE_VALUE}>
        <Accordion.Trigger accessibilityLabel={title} className="min-h-11">
          <View style={styles.heading}>
            <AppText variant="caption">{title}</AppText>
            <Accordion.Indicator />
          </View>
        </Accordion.Trigger>
        <Accordion.Content className="mt-3 rounded-xl bg-surface-secondary p-4">
          {children}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

const styles = StyleSheet.create({
  heading: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
