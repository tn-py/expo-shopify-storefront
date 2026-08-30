import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AppTextProps = TextProps & {
  variant?: 'body' | 'caption' | 'label' | 'title' | 'heading' | 'price';
  tone?: ThemeColor;
};

export function AppText({ variant = 'body', tone, style, ...props }: AppTextProps) {
  const theme = useTheme();
  return <Text style={[styles[variant], { color: theme[tone ?? 'text'] }, style]} {...props} />;
}

const styles = StyleSheet.create({
  body: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 20 },
  title: { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: Fonts.semibold, fontSize: 20, lineHeight: 26 },
  price: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 24 },
});
