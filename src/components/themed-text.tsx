import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color =
    themeColor != null
      ? theme[themeColor]
      : type === 'link' || type === 'linkPrimary'
        ? theme.primary
        : theme.text;

  return (
    <Text
      style={[
        { color },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  smallBold: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 19,
  },
  default: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: Fonts.semibold,
    fontSize: 19,
    lineHeight: 26,
  },
  link: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  linkPrimary: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
});
