import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type AppSearchFieldProps = TextInputProps & {
  disabled?: boolean;
};

export function AppSearchField({
  disabled = false,
  style,
  editable: _editable,
  accessibilityRole: _accessibilityRole,
  accessibilityState,
  ...props
}: AppSearchFieldProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <TextInput
        {...props}
        accessibilityRole="search"
        accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
        editable={!isDisabled}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 44, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  input: { minHeight: 44, paddingHorizontal: 12, fontSize: 16 },
});
