import { fireEvent, render } from '@testing-library/react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppSearchField } from '@/components/ui/app-search-field';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { SelectableChip } from '@/components/ui/selectable-chip';

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
});
