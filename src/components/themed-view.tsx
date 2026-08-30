import { type ViewProps } from 'react-native';

import { AppSurface } from '@/components/ui/app-surface';
import { type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  const backgroundColor = lightColor ?? darkColor ?? theme[type ?? 'background'];
  return <AppSurface style={[{ backgroundColor }, style]} {...otherProps} />;
}
