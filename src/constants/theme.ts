/**
 * Design tokens. The accent colours come from `EXPO_PUBLIC_BRAND_*` env vars so
 * the template can be rebranded without touching code; everything else is a
 * neutral light/dark scale. Typography is Montserrat (loaded in
 * `src/app/_layout.tsx`) — swap the font package there to change it.
 */

import { Platform } from 'react-native';

const pick = (value: string | undefined, fallback: string): string =>
  value && value.trim() ? value.trim() : fallback;

const brand = {
  /** Primary accent — buttons, links, active tab, notification colour. */
  primary: pick(process.env.EXPO_PUBLIC_BRAND_PRIMARY, '#0a7ea4'),
  /** Foreground used on top of `primary` (button labels, etc.). */
  onPrimary: pick(process.env.EXPO_PUBLIC_BRAND_ON_PRIMARY, '#ffffff'),
  /** Sale / discounted price + cart badge. */
  sale: pick(process.env.EXPO_PUBLIC_BRAND_SALE, '#d1453b'),
};

export const Colors = {
  light: {
    text: '#1b1b1b',
    background: '#ffffff',
    backgroundElement: '#f4f4f5',
    backgroundSelected: '#e7e7e9',
    textSecondary: '#6b7280',
    border: '#e4e4e7',
    primary: brand.primary,
    onPrimary: brand.onPrimary,
    sale: brand.sale,
  },
  dark: {
    text: '#f4f5f7',
    background: '#0e1116',
    backgroundElement: '#1a1e26',
    backgroundSelected: '#282e3a',
    textSecondary: '#9aa2ad',
    border: '#282e3a',
    primary: brand.primary,
    onPrimary: brand.onPrimary,
    sale: brand.sale,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Brand = brand;

/**
 * `light` | `dark` force a fixed palette; anything else (default `system`)
 * follows the device setting. Read by `src/hooks/use-theme.ts` and
 * `src/app/_layout.tsx`.
 */
export const AppColorScheme = pick(
  process.env.EXPO_PUBLIC_APP_COLOR_SCHEME,
  'system',
).toLowerCase();

/** Font families registered in app/_layout.tsx via @expo-google-fonts/montserrat. */
export const Fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
