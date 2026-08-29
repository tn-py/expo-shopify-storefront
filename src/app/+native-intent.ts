/**
 * Rewrites inbound deep links / universal links to app routes.
 *
 * Shopify storefronts use plural paths (`/products/<handle>`,
 * `/collections/<handle>`); the app routes are singular (`/product/<handle>`,
 * `/collection/<handle>`). Anything not matched here is returned untouched.
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

  try {
    let p = path;

    if (/^https?:\/\//i.test(p)) {
      p = new URL(p).pathname;
    } else if (/^[a-z][a-z0-9.+-]*:\/\//i.test(p)) {
      // Custom scheme (shopstore://…, shop.<id>.app://…) -> path only.
      p = p.replace(/^[a-z][a-z0-9.+-]*:\/\/[^/]*/i, '');
    }
    if (!p) return path;
    if (!p.startsWith('/')) p = `/${p}`;

    const product = p.match(/^\/products\/([^/?#]+)/);
    if (product) return `/product/${product[1]}`;

    const collection = p.match(/^\/collections\/([^/?#]+)/);
    if (collection) return `/collection/${collection[1]}`;

    if (/^\/(pages\/)?search(\b|\/|$)/.test(p)) return '/search';

    // Not a storefront-shaped URL — let Expo Router resolve it as-is.
    return path;
  } catch {
    return path;
  }
}
