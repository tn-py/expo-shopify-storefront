import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { initQueryLifecycle } from '@/lib/query-lifecycle';

jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

describe('initQueryLifecycle', () => {
  it('drives focusManager from AppState foreground/background transitions', () => {
    let handleChange: (status: AppStateStatus) => void = () => {};
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener: (status: AppStateStatus) => void) => {
        handleChange = listener;
        return { remove: jest.fn() } as unknown as NativeEventSubscription;
      });

    initQueryLifecycle();

    handleChange('background');
    expect(focusManager.isFocused()).toBe(false);

    handleChange('active');
    expect(focusManager.isFocused()).toBe(true);
  });

  it('drives onlineManager from expo-network connectivity events', () => {
    initQueryLifecycle();
    const [handleNetworkChange] = (Network.addNetworkStateListener as jest.Mock).mock.calls.at(
      -1,
    ) as [(state: { isConnected?: boolean }) => void];

    handleNetworkChange({ isConnected: false });
    expect(onlineManager.isOnline()).toBe(false);

    handleNetworkChange({ isConnected: true });
    expect(onlineManager.isOnline()).toBe(true);
  });
});
