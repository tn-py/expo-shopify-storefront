import { HeroUINativeProvider } from 'heroui-native/provider';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  render as baseRender,
  type RenderOptions,
} from '@testing-library/react-native/pure';

export * from '@testing-library/react-native/pure';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

function CommerceTestProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <HeroUINativeProvider
        config={{
          animation: 'disable-all',
          toast: false,
          devInfo: { stylingPrinciples: false },
        }}>
        {children}
      </HeroUINativeProvider>
    </SafeAreaProvider>
  );
}

export function render<T>(element: React.ReactElement<T>, options: RenderOptions = {}) {
  const UserWrapper = options.wrapper;
  const Wrapper = ({ children }: PropsWithChildren) => (
    <CommerceTestProviders>
      {UserWrapper ? <UserWrapper>{children}</UserWrapper> : children}
    </CommerceTestProviders>
  );
  return baseRender(element, { ...options, wrapper: Wrapper });
}
