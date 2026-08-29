import { router } from 'expo-router';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  LogLevel,
  OneSignal,
  type NotificationClickEvent,
} from 'react-native-onesignal';

import { routeForLink } from '@/lib/deep-link';

/**
 * OneSignal push notifications — optional, and a no-op until
 * `EXPO_PUBLIC_ONESIGNAL_APP_ID` is set (see `.env.example` and
 * `docs/push-notifications.md`). Mirrors the shape of `src/lib/analytics.ts`:
 * every export below is safe to call whether or not push is configured.
 *
 * `react-native-onesignal` is a native module, so a dev client / release build
 * is required — it does nothing in Expo Go.
 */

const appId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim() ?? '';

/** True when an OneSignal app id is present. */
export const isPushConfigured = appId.length > 0;

let started = false;

/** Idempotent — initialises the SDK the first time it's needed. */
function ensureStarted(): void {
  if (!isPushConfigured || started) return;
  started = true;
  OneSignal.Debug.setLogLevel(__DEV__ ? LogLevel.Warn : LogLevel.None);
  OneSignal.initialize(appId);
}

/** The URL a tapped notification should open, if any. */
function targetUrl(event: NotificationClickEvent): string | undefined {
  const data = event.notification.additionalData as
    | { url?: unknown }
    | undefined;
  if (data && typeof data.url === 'string' && data.url) return data.url;
  return event.result.url ?? event.notification.launchURL ?? undefined;
}

/**
 * Route a tapped notification into the app. Storefront-shaped links
 * (`/products/…`, `/collections/…`, `/search`) resolve to the matching screen;
 * any other in-app path is pushed as-is; off-site URLs are ignored here (the OS
 * opens them).
 */
function handleClick(event: NotificationClickEvent): void {
  const url = targetUrl(event);
  if (!url) return;
  const route = routeForLink(url);
  if (route) router.push(route as never);
}

/** Link the OneSignal user to your Shopify customer. Call on sign-in. */
export function identifyPushUser(
  externalId: string,
  email?: string | null,
): void {
  if (!isPushConfigured || !externalId) return;
  ensureStarted();
  OneSignal.login(externalId);
  if (email) OneSignal.User.addEmail(email);
}

/** Unlink on sign-out. */
export function resetPushUser(): void {
  if (!isPushConfigured) return;
  ensureStarted();
  OneSignal.logout();
}

/** Attach data tags to the current user (for segmentation). */
export function setPushTags(tags: Record<string, string>): void {
  if (!isPushConfigured) return;
  ensureStarted();
  OneSignal.User.addTags(tags);
}

/**
 * Prompt the OS notification-permission dialog (also covers Android 13+'s
 * `POST_NOTIFICATIONS`). Resolves to the granted state; `false` when push
 * isn't configured. Call it from a screen, after explaining the value.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!isPushConfigured) return false;
  ensureStarted();
  return OneSignal.Notifications.requestPermission(true);
}

/** Current OS permission state (`false` when push isn't configured). */
export async function getPushPermission(): Promise<boolean> {
  if (!isPushConfigured) return false;
  ensureStarted();
  return OneSignal.Notifications.getPermissionAsync();
}

/**
 * Mounts the SDK and wires notification taps to in-app navigation. Renders its
 * children unchanged; safe to keep in the tree when push isn't configured.
 */
export function PushProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!isPushConfigured) return;
    ensureStarted();
    OneSignal.Notifications.addEventListener('click', handleClick);
    return () => {
      OneSignal.Notifications.removeEventListener('click', handleClick);
    };
  }, []);

  return <>{children}</>;
}
