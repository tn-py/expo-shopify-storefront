import '@testing-library/react-native/dist/matchers/extend-expect';
import { cleanup } from '@testing-library/react-native/pure';

// The real package pulls in @sentry/core's ESM build, which Jest can't parse
// without extra transform config; a lightweight mock keeps tests deterministic
// and avoids sending anything to Sentry from the test run.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  wrap: jest.fn((Component: unknown) => Component),
}));
// @shopify/checkout-sheet-kit ships its source as `.d.ts` files that double
// as runtime modules (real enum values live there, not just types) — Metro's
// resolver handles that, but Jest's plain CommonJS resolution can't parse
// them. A lightweight mock keeps every screen that merely imports the
// package (even indirectly, e.g. through a barrel file) safe to render in
// tests; suites that exercise checkout-sheet-kit behavior directly (see
// `src/shopify/checkout-hook.test.tsx`, `accelerated-checkout.test.tsx`)
// override this with their own more detailed `jest.mock` call.
jest.mock('@shopify/checkout-sheet-kit', () => ({
  ColorScheme: { automatic: 'automatic', light: 'light', dark: 'dark', web: 'web_default' },
  LogLevel: { debug: 'debug', error: 'error' },
  AcceleratedCheckoutWallet: { shopPay: 'shopPay', applePay: 'applePay' },
  ApplePayContactField: { email: 'email', phone: 'phone' },
  ApplePayLabel: { plain: 'plain' },
  ApplePayStyle: { automatic: 'automatic' },
  RenderState: { Loading: 'loading', Rendered: 'rendered', Error: 'error' },
  CheckoutExpiredError: class CheckoutExpiredError extends Error {},
  CheckoutClientError: class CheckoutClientError extends Error {},
  CheckoutHTTPError: class CheckoutHTTPError extends Error {},
  ConfigurationError: class ConfigurationError extends Error {},
  InternalError: class InternalError extends Error {},
  GenericError: class GenericError extends Error {},
  useShopifyCheckoutSheet: () => ({
    preload: jest.fn(),
    present: jest.fn(),
    dismiss: jest.fn(),
    invalidate: jest.fn(),
    getConfig: jest.fn(async () => ({})),
    setConfig: jest.fn(async () => undefined),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListeners: jest.fn(),
  }),
  ShopifyCheckoutSheetProvider: ({ children }: { children?: unknown }) => children ?? null,
  AcceleratedCheckoutButtons: () => null,
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.useReducedMotion = () => false;
  return Reanimated;
});
jest.mock('uniwind', () => {
  const actual = jest.requireActual('uniwind');
  const values: Record<string, string> = {
    '--theme': 'default',
    '--background': '#ffffff',
    '--foreground': '#1b1b1b',
    '--surface': '#ffffff',
    '--surface-foreground': '#1b1b1b',
    '--muted': '#6b7280',
    '--default': '#f4f4f5',
    '--default-foreground': '#1b1b1b',
    '--accent': '#0a7ea4',
    '--accent-foreground': '#ffffff',
    '--success': '#16803c',
    '--warning': '#9a6700',
    '--danger': '#d1453b',
    '--border': '#e4e4e7',
  };
  const resolve = (name: string) => values[name] ?? '#1b1b1b';
  return {
    ...actual,
    useCSSVariable: (name: string | string[]) => Array.isArray(name)
      ? name.map(resolve)
      : resolve(name),
  };
});

afterEach(cleanup);

// Native AsyncStorage is unavailable under Jest; suites that assert storage
// behaviour still override this with their own `jest.mock`.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
