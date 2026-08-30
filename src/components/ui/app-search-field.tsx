import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type AppSearchFieldProps = TextInputProps & {
  disabled?: boolean;
};

export function AppSearchField({ disabled = false, style, ...props }: AppSearchFieldProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <TextInput
        accessibilityRole="search"
        accessibilityState={{ disabled }}
        editable={!disabled}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 44, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  input: { minHeight: 44, paddingHorizontal: 12, fontSize: 16 },
});
