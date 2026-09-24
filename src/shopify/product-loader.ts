import { storefront } from './client';
import { inContextVariables } from './locale';
import { PRODUCT_QUERY, PRODUCT_VARIANTS_QUERY } from './queries';
import type { Connection, Product, ProductVariant } from './types';

interface ProductResult {
  product: Product | null;
}

interface ProductVariantsResult {
  product: { variants: Connection<ProductVariant> } | null;
}

export type StorefrontRequester = <TData>(
  operation: string,
  variables?: Record<string, unknown>,
) => Promise<TData>;

const VARIANT_PAGE_SIZE = 100;

/**
 * Fetch every variant page before exposing a product to option resolution.
 * A partial variant connection would incorrectly make later combinations look
 * unavailable, so malformed pagination is treated as a load failure instead.
 */
export async function loadProductWithAllVariants(
  handle: string,
  request: StorefrontRequester = storefront,
): Promise<ProductResult> {
  const result = await request<ProductResult>(PRODUCT_QUERY, {
    handle,
    ...inContextVariables(),
  });
  if (!result.product) return result;

  const variants = [...result.product.variants.nodes];
  const variantIds = new Set(variants.map((variant) => variant.id));
  const visitedCursors = new Set<string>();
  let pageInfo = result.product.variants.pageInfo;

  while (pageInfo.hasNextPage) {
    const cursor = pageInfo.endCursor;
    if (!cursor || visitedCursors.has(cursor)) {
      throw new Error('Storefront variant pagination did not provide a new cursor.');
    }
    visitedCursors.add(cursor);

    const page = await request<ProductVariantsResult>(PRODUCT_VARIANTS_QUERY, {
      handle,
      first: VARIANT_PAGE_SIZE,
      after: cursor,
      ...inContextVariables(),
    });
    const connection = page.product?.variants;
    if (!connection) {
      throw new Error('Product became unavailable while loading its variants.');
    }

    connection.nodes.forEach((variant) => {
      if (!variantIds.has(variant.id)) {
        variantIds.add(variant.id);
        variants.push(variant);
      }
    });
    pageInfo = connection.pageInfo;
  }

  return {
    product: {
      ...result.product,
      variants: { nodes: variants, pageInfo },
    },
  };
}
