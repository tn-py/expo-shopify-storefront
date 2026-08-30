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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies configured brand colors to both Uniwind themes and follows the configured scheme', () => {
    initializeTheme();

    const expectedVariables = {
      '--accent': Brand.primary,
      '--accent-foreground': Brand.onPrimary,
      '--danger': Brand.sale,
      '--danger-foreground': Brand.onPrimary,
      '--sale': Brand.sale,
    };

    expect(Uniwind.updateCSSVariables).toHaveBeenCalledWith('light', expectedVariables);
    expect(Uniwind.updateCSSVariables).toHaveBeenCalledWith('dark', expectedVariables);
    expect(Uniwind.setTheme).toHaveBeenCalledWith('system');
  });

  it.each(['light', 'dark'] as const)('honors a forced %s commerce theme', (scheme) => {
    initializeTheme(scheme);

    expect(Uniwind.setTheme).toHaveBeenCalledWith(scheme);
  });
});
