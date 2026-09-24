/**
 * Resolves the active colour palette. Controlled by `EXPO_PUBLIC_APP_COLOR_SCHEME`
 * (`light` | `dark` | `system`, default `system`).
 */

import { useColorScheme } from 'react-native';

import { AppColorScheme, Colors } from '@/constants/theme';

export function useResolvedScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  if (AppColorScheme === 'light' || AppColorScheme === 'dark') {
    return AppColorScheme;
  }
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[useResolvedScheme()];
}
