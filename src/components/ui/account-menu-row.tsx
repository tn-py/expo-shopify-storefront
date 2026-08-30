import { ListGroup } from 'heroui-native/list-group';
import { StyleSheet, type PressableProps } from 'react-native';

export type AccountMenuRowProps = Omit<PressableProps, 'children'> & { label: string; detail?: string };

export function AccountMenuRow({
  label,
  detail,
  disabled = false,
  style,
  className,
  accessibilityRole: _accessibilityRole,
  accessibilityState,
  ...props
}: AccountMenuRowProps) {
  const isDisabled = Boolean(disabled);
  return (
    <ListGroup.Item
      {...props}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
      disabled={isDisabled}
      className={[className, 'min-h-14 border-b border-border'].filter(Boolean).join(' ')}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        styles.row,
        isDisabled && styles.disabled,
      ]}>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{label}</ListGroup.ItemTitle>
        {detail ? <ListGroup.ItemDescription>{detail}</ListGroup.ItemDescription> : null}
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix />
    </ListGroup.Item>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  disabled: { opacity: 0.45 },
});
