import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Fonts, Spacing } from '@/constants/theme';

export default function OrderConfirmedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        <ThemedText style={styles.check}>✓</ThemedText>
        <ThemedText type="title" style={styles.center}>
          Order placed
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Thanks for your order. A confirmation email is on its way, and you can
          track it from your account.
        </ThemedText>
      </View>
      <Pressable
        onPress={() => router.replace('/')}
        style={[styles.btn, { marginBottom: insets.bottom + Spacing.three }]}>
        <ThemedText style={styles.btnText}>Continue shopping</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four, justifyContent: 'space-between' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  check: { fontSize: 56, color: '#12B76A' },
  center: { textAlign: 'center' },
  btn: {
    backgroundColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontFamily: Fonts.bold, fontSize: 16 },
});
