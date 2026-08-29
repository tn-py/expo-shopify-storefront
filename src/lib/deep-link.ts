/**
 * Shared deep-link normalisation.
 *
 * Shopify storefront URLs use plural paths (`/products/<handle>`,
 * `/collections/<handle>`); the app routes are singular (`/product/<handle>`,
 * `/collection/<handle>`). This maps one to the other in a single place, used by:
 *   - `src/app/+native-intent.ts` — inbound system deep / universal links
 *   - `src/notifications/onesignal.tsx` — a notification's "Launch URL" or a
 *     custom `url` data value
 */

/** Hosts configured for https App Links / Universal Links (comma list). */
const APP_HOSTS = (process.env.EXPO_PUBLIC_APP_UNIVERSAL_LINK_DOMAINS ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/**
 * Reduce a URL or bare path to its path (+ query). Returns `null` when the input
 * is an http(s) URL pointing at a host that isn't one of ours — those should be
 * opened in the browser, not routed in-app.
 */
export function urlToPath(input: string): string | null {
  let p = input.trim();
  if (!p) return null;

  try {
    if (/^https?:\/\//i.test(p)) {
      const u = new URL(p);
      if (APP_HOSTS.length > 0 && !APP_HOSTS.includes(u.host.toLowerCase())) {
        return null;
      }
      p = u.pathname + u.search;
    } else if (/^[a-z][a-z0-9.+-]*:\/\//i.test(p)) {
      // Custom scheme (shopstore://…, shop.<id>.app://…) -> path only.
      p = p.replace(/^[a-z][a-z0-9.+-]*:\/\/[^/]*/i, '');
    }
  } catch {
    return null;
  }

  if (!p) return null;
  return p.startsWith('/') ? p : `/${p}`;
}

/**
 * Map a storefront-shaped path to the matching app route, or `null` when the
 * path isn't one the app has a dedicated screen for.
 */
export function storefrontPathToRoute(path: string): string | null {
  const product = path.match(/^\/products\/([^/?#]+)/);
  if (product) return `/product/${product[1]}`;

  const collection = path.match(/^\/collections\/([^/?#]+)/);
  if (collection) return `/collection/${collection[1]}`;

  if (/^\/(pages\/)?search(\b|\/|$)/.test(path)) return '/search';

  return null;
}

/**
 * Best-effort in-app route for any inbound link (used by the push handler).
 * Returns a route string to `router.push`, or `null` to let the caller fall
 * back to opening the link externally.
 */
export function routeForLink(input: string): string | null {
  const path = urlToPath(input);
  if (!path) return null;
  return storefrontPathToRoute(path) ?? path;
}
