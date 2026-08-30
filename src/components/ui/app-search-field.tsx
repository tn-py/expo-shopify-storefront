import { SearchField } from 'heroui-native/search-field';
import { StyleSheet, type TextInputProps } from 'react-native';

export type AppSearchFieldProps = TextInputProps & {
  disabled?: boolean;
};

export function AppSearchField({
  disabled = false,
  value,
  onChangeText,
  style,
  editable: _editable,
  accessibilityRole: _accessibilityRole,
  accessibilityState,
  className,
  ...props
}: AppSearchFieldProps) {
  const isDisabled = Boolean(disabled);

  return (
    <SearchField
      value={value}
      onChange={onChangeText}
      isDisabled={isDisabled}
      className="w-full">
      <SearchField.Group className="min-h-11">
        <SearchField.SearchIcon />
        <SearchField.Input
          {...props}
          accessibilityRole="search"
          accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
          className={['min-h-11 text-foreground', className].filter(Boolean).join(' ')}
          style={[styles.input, style]}
        />
      </SearchField.Group>
    </SearchField>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 44, paddingHorizontal: 12, fontSize: 16 },
});
