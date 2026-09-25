import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * TanStack Query's default focus/online detection is browser-only (`window`
 * focus events, `navigator.onLine`) and never fires in React Native. Point
 * both managers at the native equivalents — app foreground/background and
 * device connectivity — so `refetchOnWindowFocus` and offline pausing work.
 * Call once from `_layout.tsx`.
 */
export function initQueryLifecycle(): void {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      handleFocus(status === 'active');
    });
    return () => subscription.remove();
  });

  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(Boolean(state.isConnected));
    });
    return () => subscription.remove();
  });
}
