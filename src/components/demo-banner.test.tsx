import { fireEvent, render } from '@testing-library/react-native';
import { Fragment, type ReactNode } from 'react';

import TabsLayout from '@/app/(tabs)/_layout';
import { DemoBanner } from '@/components/demo-banner';

const mockPush = jest.fn();
let mockIsDemoStore = false;
let mockIsStorefrontUsable = true;

function MockTabs({ children }: { children?: ReactNode }) {
  return <Fragment>{children}</Fragment>;
}
MockTabs.Screen = function MockTabsScreen() {
  return null;
};

jest.mock('expo-router', () => ({
  Tabs: MockTabs,
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/shopify/cart', () => ({ useCart: () => ({ totalQuantity: 0 }) }));

jest.mock('@/shopify/env', () => ({
  get isDemoStore() {
    return mockIsDemoStore;
  },
  get isStorefrontUsable() {
    return mockIsStorefrontUsable;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDemoStore = false;
  mockIsStorefrontUsable = true;
});

describe('TabsLayout', () => {
  it('shows the setup wall when the storefront is not usable (demo mode off, nothing configured)', async () => {
    mockIsStorefrontUsable = false;
    mockIsDemoStore = false;
    const view = await render(<TabsLayout />);

    expect(view.getByText('Almost there')).toBeOnTheScreen();
  });

  it('shows the storefront (no setup wall) and the demo pill in demo mode', async () => {
    mockIsStorefrontUsable = true;
    mockIsDemoStore = true;
    const view = await render(<TabsLayout />);

    expect(view.queryByText('Almost there')).toBeNull();
    expect(
      view.getByRole('button', { name: /Demo store, browsing sample products/ }),
    ).toBeOnTheScreen();
  });

  it('shows the storefront with no demo pill for a configured store', async () => {
    mockIsStorefrontUsable = true;
    mockIsDemoStore = false;
    const view = await render(<TabsLayout />);

    expect(view.queryByText('Almost there')).toBeNull();
    expect(view.queryByText('Demo store · Connect yours')).toBeNull();
  });
});

describe('DemoBanner', () => {
  it('pushes /setup when the pill is pressed', async () => {
    const view = await render(<DemoBanner />);

    fireEvent.press(view.getByText('Demo store · Connect yours'));
    expect(mockPush).toHaveBeenCalledWith('/setup');
  });

  it('is dismissible and stays dismissed for the session', async () => {
    const view = await render(<DemoBanner />);

    expect(view.getByText('Demo store · Connect yours')).toBeOnTheScreen();
    await fireEvent.press(view.getByRole('button', { name: 'Dismiss demo store banner' }));
    expect(view.queryByText('Demo store · Connect yours')).toBeNull();
  });

  it('exposes an accessible button role and label for the tap target', async () => {
    const view = await render(<DemoBanner />);

    expect(
      view.getByRole('button', {
        name: 'Demo store, browsing sample products. Tap to connect your own store.',
      }),
    ).toBeOnTheScreen();
  });
});
