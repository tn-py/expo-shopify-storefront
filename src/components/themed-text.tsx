import { type TextProps } from 'react-native';

import { AppText, type AppTextProps } from '@/components/ui/app-text';
import { type ThemeColor } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

const variants: Record<NonNullable<ThemedTextProps['type']>, AppTextProps['variant']> = {
  default: 'body',
  title: 'title',
  small: 'caption',
  smallBold: 'captionStrong',
  subtitle: 'heading',
  link: 'labelStrong',
  linkPrimary: 'labelStrong',
  code: 'code',
};

export function ThemedText({ type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const tone = themeColor ?? (type === 'link' || type === 'linkPrimary' ? 'primary' : 'text');
  return <AppText variant={variants[type]} tone={tone} {...rest} />;
}
