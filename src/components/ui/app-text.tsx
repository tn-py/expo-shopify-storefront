import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontWeights, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AppTextProps = TextProps & {
  variant?: 'body' | 'caption' | 'captionStrong' | 'label' | 'labelStrong' | 'title' | 'heading' | 'price' | 'code';
  tone?: ThemeColor;
};

export function AppText({ variant = 'body', tone, style, ...props }: AppTextProps) {
  const theme = useTheme();
  return <Text style={[styles[variant], { color: theme[tone ?? 'text'] }, style]} {...props} />;
}

const styles = StyleSheet.create({
  body: { fontFamily: Fonts.regular, fontWeight: FontWeights.regular, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: Fonts.regular, fontWeight: FontWeights.regular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: Fonts.regular, fontWeight: FontWeights.bold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: Fonts.medium, fontWeight: FontWeights.medium, fontSize: 14, lineHeight: 20 },
  labelStrong: { fontFamily: Fonts.semibold, fontWeight: FontWeights.semibold, fontSize: 14, lineHeight: 20 },
  title: { fontFamily: Fonts.bold, fontWeight: FontWeights.bold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: Fonts.semibold, fontWeight: FontWeights.semibold, fontSize: 20, lineHeight: 26 },
  price: { fontFamily: Fonts.semibold, fontWeight: FontWeights.semibold, fontSize: 17, lineHeight: 24 },
  code: { fontFamily: Fonts.mono, fontWeight: FontWeights.regular, fontSize: 12, lineHeight: 18 },
});
