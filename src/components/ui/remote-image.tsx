import { Image } from 'expo-image';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type RemoteImageProps = {
  uri?: string | null;
  alt: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
};

export function RemoteImage({ uri, alt, style, contentFit = 'cover' }: RemoteImageProps) {
  const theme = useTheme();
  if (!uri) return <View accessibilityLabel={`${alt} unavailable`} style={[styles.fallback, { backgroundColor: theme.backgroundElement }, style]} />;
  return <Image accessibilityLabel={alt} contentFit={contentFit} source={{ uri }} style={style} transition={150} />;
}

const styles = StyleSheet.create({ fallback: { minHeight: 44 } });
