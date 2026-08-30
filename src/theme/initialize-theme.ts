import { Uniwind } from 'uniwind';

import { AppColorScheme, Brand } from '@/constants/theme';

const themeVariables = {
  '--accent': Brand.primary,
  '--accent-foreground': Brand.onPrimary,
  '--danger': Brand.sale,
  '--danger-foreground': Brand.onPrimary,
  '--sale': Brand.sale,
};

/** Synchronizes the runtime brand configuration with Uniwind's active palette. */
export function initializeTheme(scheme = AppColorScheme): void {
  Uniwind.updateCSSVariables('light', themeVariables);
  Uniwind.updateCSSVariables('dark', themeVariables);
  Uniwind.setTheme(scheme === 'light' || scheme === 'dark' ? scheme : 'system');
}
