import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

/** True when Sentry is configured — every helper below no-ops otherwise. */
export const isMonitoringConfigured = dsn.length > 0;

/** Call once at module scope (see `src/app/_layout.tsx`). No-op without a DSN. */
export function initMonitoring(): void {
  if (!isMonitoringConfigured) return;
  Sentry.init({
    dsn,
    // Never ship PII (IP address, device name, etc.) to Sentry by default.
    sendDefaultPii: false,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!isMonitoringConfigured) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function setMonitoringUser(id: string | null): void {
  if (!isMonitoringConfigured) return;
  Sentry.setUser(id ? { id } : null);
}

/** Wraps the root component for Sentry's native error/performance instrumentation. */
export function wrapRoot<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
): ComponentType<P> {
  return isMonitoringConfigured ? Sentry.wrap(Component) : Component;
}
