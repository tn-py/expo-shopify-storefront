import { Typography } from 'heroui-native/text';
import { StyleSheet, type TextProps } from 'react-native';

import { Fonts, FontWeights, type ThemeColor } from '@/constants/theme';

export type AppTextProps = TextProps & {
  variant?: 'body' | 'caption' | 'captionStrong' | 'label' | 'labelStrong' | 'title' | 'heading' | 'price' | 'code';
  tone?: ThemeColor;
};

const typography = {
  body: { type: 'body', weight: 'normal' },
  caption: { type: 'body-xs', weight: 'normal' },
  captionStrong: { type: 'body-xs', weight: 'bold' },
  label: { type: 'body-sm', weight: 'medium' },
  labelStrong: { type: 'body-sm', weight: 'semibold' },
  title: { type: 'h2', weight: 'bold' },
  heading: { type: 'h4', weight: 'semibold' },
  price: { type: 'body', weight: 'semibold' },
  code: { type: 'code', weight: 'normal' },
} as const;

const toneClassName: Record<ThemeColor, string> = {
  text: 'text-foreground',
  background: 'text-background',
  backgroundElement: 'text-surface-secondary',
  backgroundSelected: 'text-surface-tertiary',
  textSecondary: 'text-muted',
  border: 'text-border',
  primary: 'text-accent',
  onPrimary: 'text-accent-foreground',
  sale: 'text-sale',
};

export function AppText({ variant = 'body', tone = 'text', className, style, ...props }: AppTextProps) {
  const semantic = typography[variant];
  return (
    <Typography
      type={semantic.type}
      weight={semantic.weight}
      className={[toneClassName[tone], className].filter(Boolean).join(' ')}
      style={[styles[variant], style]}
      {...props}
    />
  );
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
