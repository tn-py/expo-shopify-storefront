import { storefrontPathToRoute, urlToPath } from '@/lib/deep-link';

/**
 * Rewrites inbound deep links / universal links to app routes.
 *
 * Shopify storefronts use plural paths (`/products/<handle>`,
 * `/collections/<handle>`); the app routes are singular (`/product/<handle>`,
 * `/collection/<handle>`). Anything not matched is returned untouched so Expo
 * Router can resolve it as-is. Shared with the push handler via `@/lib/deep-link`.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  // Never touch expo-dev-client / launcher URLs — they aren't app routes.
  if (/expo-development-client|expo-dev-launcher|EXDevMenu/.test(path)) {
    return path;
  }

  const normalized = urlToPath(path);
  if (!normalized) return path;

  return storefrontPathToRoute(normalized) ?? path;
}
