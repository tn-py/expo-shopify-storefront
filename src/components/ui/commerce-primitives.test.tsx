import { fireEvent, render } from '@testing-library/react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppSearchField } from '@/components/ui/app-search-field';
import { AppText } from '@/components/ui/app-text';
import { AccountMenuRow } from '@/components/ui/account-menu-row';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { SelectableChip } from '@/components/ui/selectable-chip';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';

describe('commerce controls', () => {
  it('renders a primary button as a 44-point accessible target and exposes busy and disabled state', async () => {
    const { getByRole } = await render(<AppButton label="Add to cart" loading disabled onPress={jest.fn()} />);

    const button = getByRole('button', { name: 'Add to cart' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    expect(button).toHaveStyle({ minHeight: 44 });
  });

  it('uses its secondary variant without changing the semantic button contract', async () => {
    const { getByRole } = await render(<AppButton label="Save for later" variant="secondary" onPress={jest.fn()} />);

    expect(getByRole('button', { name: 'Save for later' })).toHaveStyle({ minHeight: 44 });
  });

  it('prevents decrement below the minimum while retaining accessible button targets', async () => {
    const onChange = jest.fn();
    const { getByRole } = await render(<QuantityStepper value={1} min={1} onChange={onChange} />);

    const decrement = getByRole('button', { name: 'Decrease quantity' });
    expect(decrement).toBeDisabled();
    expect(decrement).toHaveStyle({ minHeight: 44, minWidth: 44 });
    await fireEvent.press(decrement);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a selected chip as selected and submits its value', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<SelectableChip label="Medium" selected onPress={onPress} />);

    const chip = getByRole('button', { name: 'Medium' });
    expect(chip).toBeSelected();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps a disabled search field unavailable to assistive technology and input', async () => {
    const { getByRole } = await render(<AppSearchField value="dress" onChangeText={jest.fn()} disabled />);

    expect(getByRole('search')).toBeDisabled();
  });

  it('does not let caller input props re-enable a disabled search field', async () => {
    const { getByLabelText } = await render(
      <AppSearchField
        accessibilityLabel="Search catalog"
        accessibilityRole="text"
        accessibilityState={{ disabled: false }}
        disabled
        editable
        value="dress"
        onChangeText={jest.fn()}
      />,
    );

    const search = getByLabelText('Search catalog');
    expect(search).toBeDisabled();
    expect(search).toHaveProp('editable', false);
  });

  it('preserves semantic font weights and monospace code text', async () => {
    const { getByText } = await render(
      <>
        <AppText variant="label">Medium label</AppText>
        <AppText variant="heading">Semibold heading</AppText>
        <AppText variant="title">Bold title</AppText>
        <ThemedText type="smallBold">Bold caption</ThemedText>
        <ThemedText type="subtitle">Semibold subtitle</ThemedText>
        <ThemedText type="link">Semibold link</ThemedText>
        <ThemedText type="code">{"const sku = '1';"}</ThemedText>
      </>,
    );

    expect(getByText('Medium label')).toHaveStyle({ fontWeight: '500' });
    expect(getByText('Semibold heading')).toHaveStyle({ fontWeight: '600' });
    expect(getByText('Bold title')).toHaveStyle({ fontWeight: '700' });
    expect(getByText('Bold caption')).toHaveStyle({ fontWeight: '700' });
    expect(getByText('Semibold subtitle')).toHaveStyle({ fontWeight: '600' });
    expect(getByText('Semibold link')).toHaveStyle({ fontWeight: '600' });
    expect(getByText("const sku = '1';")).toHaveStyle({ fontFamily: Fonts.mono });
  });

  it('keeps a selected chip semantic and touch-safe when caller props conflict', async () => {
    const { getByRole } = await render(
      <SelectableChip
        accessibilityRole="link"
        accessibilityState={{ selected: false, disabled: false }}
        label="Medium"
        selected
        style={() => ({ minHeight: 1, marginTop: 8 })}
      />,
    );

    const chip = getByRole('button', { name: 'Medium' });
    expect(chip).toBeSelected();
    expect(chip).toHaveStyle({ minHeight: 44 });
    expect(chip).toHaveStyle({ marginTop: 8 });
  });

  it('keeps an account row semantic and touch-safe when caller props conflict', async () => {
    const { getByRole } = await render(
      <AccountMenuRow
        accessibilityRole="link"
        accessibilityState={{ disabled: false }}
        disabled
        label="Orders"
        style={() => ({ minHeight: 1, marginTop: 8 })}
      />,
    );

    const row = getByRole('button', { name: 'Orders' });
    expect(row).toBeDisabled();
    expect(row).toHaveStyle({ minHeight: 56 });
    expect(row).toHaveStyle({ marginTop: 8 });
  });
});
