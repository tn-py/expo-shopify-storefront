import { Uniwind } from 'uniwind';

import { Brand } from '@/constants/theme';
import { initializeTheme } from '@/theme/initialize-theme';

jest.mock('uniwind', () => ({
  Uniwind: {
    setTheme: jest.fn(),
    updateCSSVariables: jest.fn(),
  },
}));

describe('initializeTheme', () => {
  it('applies configured brand colors to both Uniwind themes and follows the configured scheme', () => {
    initializeTheme();

    const expectedVariables = {
      '--accent': Brand.primary,
      '--accent-foreground': Brand.onPrimary,
      '--sale': Brand.sale,
    };

    expect(Uniwind.updateCSSVariables).toHaveBeenCalledWith('light', expectedVariables);
    expect(Uniwind.updateCSSVariables).toHaveBeenCalledWith('dark', expectedVariables);
    expect(Uniwind.setTheme).toHaveBeenCalledWith('system');
  });
});
