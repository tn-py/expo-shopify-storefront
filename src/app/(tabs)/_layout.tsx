import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, type ColorValue } from 'react-native';

import { SetupRequired } from '@/components/setup-required';
import { Brand, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCart } from '@/shopify/cart';
import { isStorefrontConfigured } from '@/shopify/env';

function CartIcon({ color, size }: { color: ColorValue; size: number }) {
  const { totalQuantity } = useCart();
  return (
    <View>
      <Ionicons name="cart-outline" color={color} size={size} />
      {totalQuantity > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{totalQuantity > 99 ? '99+' : totalQuantity}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  if (!isStorefrontConfigured) return <SetupRequired />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontFamily: Fonts.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => <CartIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: Brand.sale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: Fonts.bold },
});
