import { Uniwind } from 'uniwind';

import { AppColorScheme, Brand } from '@/constants/theme';

const themeVariables = {
  '--accent': Brand.primary,
  '--accent-foreground': Brand.onPrimary,
  '--sale': Brand.sale,
};

/** Synchronizes the runtime brand configuration with Uniwind's active palette. */
export function initializeTheme(): void {
  Uniwind.updateCSSVariables('light', themeVariables);
  Uniwind.updateCSSVariables('dark', themeVariables);
  Uniwind.setTheme(AppColorScheme === 'light' || AppColorScheme === 'dark' ? AppColorScheme : 'system');
}
