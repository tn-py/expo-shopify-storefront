import { Description } from 'heroui-native/description';
import { FieldError } from 'heroui-native/field-error';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { TextField } from 'heroui-native/text-field';
import { StyleSheet, type TextInputProps } from 'react-native';

export type AppTextFieldProps = TextInputProps & {
  label?: string;
  description?: string;
  /** A non-null message marks the field invalid and replaces the description with it. */
  errorMessage?: string | null;
  disabled?: boolean;
};

/** A labeled single-line text input, for forms outside of search (see `AppSearchField` for that). */
export function AppTextField({
  label,
  description,
  errorMessage,
  disabled = false,
  value,
  onChangeText,
  style,
  editable: _editable,
  accessibilityRole: _accessibilityRole,
  accessibilityState,
  className,
  ...props
}: AppTextFieldProps) {
  const isDisabled = Boolean(disabled);
  const isInvalid = Boolean(errorMessage);

  return (
    <TextField isDisabled={isDisabled} isInvalid={isInvalid} className="w-full">
      {label ? <Label>{label}</Label> : null}
      <Input
        {...props}
        value={value}
        onChangeText={onChangeText}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
        className={['min-h-11 text-foreground', className].filter(Boolean).join(' ')}
        style={[styles.input, style]}
      />
      {isInvalid ? (
        <FieldError>{errorMessage}</FieldError>
      ) : description ? (
        <Description>{description}</Description>
      ) : null}
    </TextField>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 44, paddingHorizontal: 12, fontSize: 16 },
});
