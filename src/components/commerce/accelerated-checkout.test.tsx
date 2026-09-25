import { act, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { WalletCheckoutButtons } from './accelerated-checkout';

const mockClearLocal = jest.fn();
const mockReplace = jest.fn();
const mockHandleCheckoutCompletion = jest.fn();
const mockNavigateToConfirmation = jest.fn();
const mockTrack = jest.fn();
const RenderState = { Loading: 'loading', Rendered: 'rendered', Error: 'error' } as const;
const AcceleratedCheckoutWallet = { shopPay: 'shopPay', applePay: 'applePay' } as const;
const mockAcceleratedCheckoutButtons = jest.fn((_props: unknown) => null);

jest.mock('@/shopify/cart', () => ({ useCart: () => ({ clearLocal: mockClearLocal }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/shopify/checkout', () => ({
  handleCheckoutCompletion: (...args: unknown[]) => mockHandleCheckoutCompletion(...args),
  navigateToConfirmation: (...args: unknown[]) => mockNavigateToConfirmation(...args),
}));
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('@shopify/checkout-sheet-kit', () => ({
  RenderState,
  AcceleratedCheckoutWallet,
  AcceleratedCheckoutButtons: (props: unknown) => mockAcceleratedCheckoutButtons(props),
}));

const originalPlatformOS = Platform.OS;
let mockEnabled = false;
let mockMerchantId = '';

jest.mock('@/shopify/env', () => ({
  get ShopifyEnv() {
    return { acceleratedCheckoutEnabled: mockEnabled, applePayMerchantId: mockMerchantId };
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockEnabled = true;
  mockMerchantId = '';
  Platform.OS = 'ios';
});

afterAll(() => {
  Platform.OS = originalPlatformOS;
});

describe('WalletCheckoutButtons', () => {
  it('renders nothing on Android even when enabled', async () => {
    Platform.OS = 'android';
    await render(<WalletCheckoutButtons cartId="gid://shopify/Cart/1" />);

    expect(mockAcceleratedCheckoutButtons).not.toHaveBeenCalled();
  });

  it('renders nothing when accelerated checkout is disabled', async () => {
    mockEnabled = false;
    await render(<WalletCheckoutButtons cartId="gid://shopify/Cart/1" />);

    expect(mockAcceleratedCheckoutButtons).not.toHaveBeenCalled();
  });

  it('offers only Shop Pay without an Apple merchant id, and both wallets when one is set', async () => {
    await render(<WalletCheckoutButtons cartId="gid://shopify/Cart/1" />);
    expect(mockAcceleratedCheckoutButtons).toHaveBeenCalledWith(
      expect.objectContaining({ wallets: [AcceleratedCheckoutWallet.shopPay] }),
    );

    mockAcceleratedCheckoutButtons.mockClear();
    mockMerchantId = 'merchant.com.example.test';
    await render(<WalletCheckoutButtons cartId="gid://shopify/Cart/1" />);
    expect(mockAcceleratedCheckoutButtons).toHaveBeenCalledWith(
      expect.objectContaining({
        wallets: [AcceleratedCheckoutWallet.shopPay, AcceleratedCheckoutWallet.applePay],
      }),
    );
  });

  it('passes the cartId or variantId/quantity props straight through', async () => {
    await render(<WalletCheckoutButtons variantId="gid://shopify/ProductVariant/1" quantity={2} />);

    expect(mockAcceleratedCheckoutButtons).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: 'gid://shopify/ProductVariant/1', quantity: 2 }),
    );
  });

  it('reuses the shared completion handler on checkout completion', async () => {
    await render(<WalletCheckoutButtons cartId="gid://shopify/Cart/1" />);
    const { onComplete } = mockAcceleratedCheckoutButtons.mock.calls[0][0] as {
      onComplete: (event: unknown) => void;
    };
    const event = { orderDetails: { id: 'gid://shopify/Order/1', cart: { price: { total: null } } } };

    onComplete(event);

    expect(mockHandleCheckoutCompletion).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ clearLocal: mockClearLocal, navigateToConfirmation: expect.any(Function) }),
    );
  });

  it('keeps the shopper cart when a product-page buy-now purchase completes', async () => {
    await render(<WalletCheckoutButtons variantId="gid://shopify/ProductVariant/1" quantity={1} />);
    const { onComplete } = mockAcceleratedCheckoutButtons.mock.calls[0][0] as {
      onComplete: (event: unknown) => void;
    };

    onComplete({ orderDetails: { id: 'gid://shopify/Order/2', cart: { price: { total: null } } } });

    const deps = mockHandleCheckoutCompletion.mock.calls[0][1] as { clearLocal: () => Promise<void> };
    expect(deps.clearLocal).not.toBe(mockClearLocal);
    await deps.clearLocal();
    expect(mockClearLocal).not.toHaveBeenCalled();
  });

  it('stops rendering once the native buttons report they cannot render', async () => {
    await render(<WalletCheckoutButtons cartId="gid://shopify/Cart/1" />);
    const { onRenderStateChange } = mockAcceleratedCheckoutButtons.mock.calls[0][0] as {
      onRenderStateChange: (event: { state: string }) => void;
    };

    mockAcceleratedCheckoutButtons.mockClear();
    await act(async () => {
      onRenderStateChange({ state: RenderState.Error });
    });

    // A second render pass happens (props/effects re-evaluated), but it must
    // not call the native buttons component again once marked unrenderable.
    expect(mockAcceleratedCheckoutButtons).not.toHaveBeenCalled();
  });
});
