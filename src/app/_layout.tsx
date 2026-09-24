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
  type ErrorBoundaryProps,
  type Theme,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StateView } from '@/components/ui';
import { AppColorScheme, Colors, Fonts } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-theme';
import { captureException, initMonitoring, wrapRoot } from '@/lib/monitoring';
import { queryClient } from '@/lib/query-client';
import { initQueryLifecycle } from '@/lib/query-lifecycle';
import { PushProvider } from '@/notifications/onesignal';
import {
  AcceleratedCheckoutConfigurator,
  acceleratedCheckoutConfiguration,
} from '@/shopify/accelerated-checkout-config';
import { AuthProvider } from '@/shopify/auth';
import { CartProvider } from '@/shopify/cart';
import { CheckoutEvents } from '@/shopify/checkout';
import { ShopifyEnv } from '@/shopify/env';
import { initializeTheme } from '@/theme/initialize-theme';

import '../../global.css';

initializeTheme();
initMonitoring();
initQueryLifecycle();

/** Reported to Sentry (when configured) and shown instead of a blank/crashed screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureException(error, { boundary: 'root-layout' });
  }, [error]);

  return (
    <SafeAreaProvider>
      <HeroUINativeProvider>
        <StateView
          mode="error"
          message={error.message}
          actionLabel="Try again"
          onAction={retry}
        />
      </HeroUINativeProvider>
    </SafeAreaProvider>
  );
}

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

function RootLayout() {
  const scheme = useResolvedScheme();
  const theme = Colors[scheme];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <QueryClientProvider client={queryClient}>
            <ShopifyCheckoutSheetProvider
              configuration={{
                colorScheme: checkoutColorScheme,
                preloading: true,
                ...(ShopifyEnv.acceleratedCheckoutEnabled
                  ? { acceleratedCheckouts: acceleratedCheckoutConfiguration(null) }
                  : {}),
              }}>
              <AuthProvider>
                <PushProvider>
                  <CartProvider>
                    <ThemeProvider value={makeNavTheme(scheme)}>
                      <CheckoutEvents />
                      <AcceleratedCheckoutConfigurator />
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
                        <Stack.Screen name="setup" options={{ title: 'Connect your store', presentation: 'modal' }} />
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

export default wrapRoot(RootLayout);
