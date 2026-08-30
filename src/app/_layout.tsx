import { QueryClientProvider } from '@tanstack/react-query';
import { HeroUINativeProvider } from 'heroui-native/provider';
import {
  ColorScheme,
  ShopifyCheckoutSheetProvider,
} from '@shopify/checkout-sheet-kit';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type Theme,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppColorScheme, Colors, Fonts } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-theme';
import { PushProvider } from '@/notifications/onesignal';
import { AuthProvider } from '@/shopify/auth';
import { CartProvider } from '@/shopify/cart';
import { CheckoutEvents } from '@/shopify/checkout';
import { queryClient } from '@/lib/query-client';
import { initializeTheme } from '@/theme/initialize-theme';

import '../../global.css';

initializeTheme();

function makeNavTheme(scheme: 'light' | 'dark'): Theme {
  const c = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.background,
      text: c.text,
      border: c.border,
    },
    fonts: {
      regular: { fontFamily: Fonts.regular, fontWeight: '400' },
      medium: { fontFamily: Fonts.medium, fontWeight: '400' },
      bold: { fontFamily: Fonts.semibold, fontWeight: '400' },
      heavy: { fontFamily: Fonts.bold, fontWeight: '400' },
    },
  };
}

const checkoutColorScheme =
  AppColorScheme === 'light'
    ? ColorScheme.light
    : AppColorScheme === 'dark'
      ? ColorScheme.dark
      : ColorScheme.automatic;

export default function RootLayout() {
  const scheme = useResolvedScheme();
  const theme = Colors[scheme];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <QueryClientProvider client={queryClient}>
            <ShopifyCheckoutSheetProvider
              configuration={{ colorScheme: checkoutColorScheme, preloading: true }}>
              <AuthProvider>
                <PushProvider>
                  <CartProvider>
                    <ThemeProvider value={makeNavTheme(scheme)}>
                      <CheckoutEvents />
                      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
                      <Stack
                        screenOptions={{
                          headerBackButtonDisplayMode: 'minimal',
                          headerTintColor: theme.primary,
                          headerTitleStyle: {
                            fontFamily: Fonts.semibold,
                            color: theme.text,
                          },
                          headerShadowVisible: false,
                          contentStyle: { backgroundColor: theme.background },
                        }}>
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="product/[handle]" options={{ title: '' }} />
                        <Stack.Screen name="collection/[handle]" options={{ title: '' }} />
                        <Stack.Screen name="account/orders" options={{ title: 'Orders' }} />
                        <Stack.Screen name="account/order/[id]" options={{ title: 'Order' }} />
                        <Stack.Screen name="account/addresses" options={{ title: 'Addresses' }} />
                        <Stack.Screen
                          name="order-confirmed"
                          options={{ headerShown: false, presentation: 'fullScreenModal' }}
                        />
                      </Stack>
                    </ThemeProvider>
                  </CartProvider>
                </PushProvider>
              </AuthProvider>
            </ShopifyCheckoutSheetProvider>
          </QueryClientProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
