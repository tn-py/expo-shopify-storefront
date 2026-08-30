import { resolveVariantSelection } from '@/components/commerce/variant-selection';
import {
  loadProductWithAllVariants,
  type StorefrontRequester,
} from '@/shopify/product-loader';
import { PRODUCT_VARIANTS_QUERY } from '@/shopify/queries';
import type { Product, ProductVariant } from '@/shopify/types';

jest.mock('@/shopify/client', () => ({ storefront: jest.fn() }));

const image = { url: 'https://example.com/shirt.jpg', altText: 'Shirt', width: 800, height: 800 };
const money = { amount: '20.00', currencyCode: 'USD' };

function variant(id: string, color: string): ProductVariant {
  return {
    id,
    title: color,
    availableForSale: true,
    price: money,
    compareAtPrice: null,
    selectedOptions: [{ name: 'Color', value: color }],
    image,
    sku: id,
  };
}

const firstPageProduct = {
  id: 'product-1',
  handle: 'shirt',
  title: 'Shirt',
  vendor: 'Studio',
  featuredImage: image,
  priceRange: { minVariantPrice: money, maxVariantPrice: money },
  compareAtPriceRange: { minVariantPrice: money, maxVariantPrice: money },
  availableForSale: true,
  description: 'A long-lived shirt.',
  descriptionHtml: '<p>A long-lived shirt.</p>',
  images: { nodes: [image] },
  options: [{ id: 'color', name: 'Color', values: ['Red', 'Purple'] }],
  variants: {
    nodes: [variant('variant-first', 'Red')],
    pageInfo: { hasNextPage: true, endCursor: 'cursor-100' },
  },
  tags: [],
} as Product;

describe('complete product variant loading', () => {
  it('paginates until a valid later-page selectable variant is available', async () => {
    const laterVariant = variant('variant-later', 'Purple');
    const responses: unknown[] = [
      { product: firstPageProduct },
      {
        product: {
          variants: {
            nodes: [laterVariant],
            pageInfo: { hasNextPage: false, endCursor: 'cursor-200' },
          },
        },
      },
    ];
    const request = jest.fn(async () => responses.shift()) as unknown as StorefrontRequester;

    const loaded = await loadProductWithAllVariants('shirt', request);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(PRODUCT_VARIANTS_QUERY, {
      handle: 'shirt',
      first: 100,
      after: 'cursor-100',
    });
    expect(resolveVariantSelection(loaded.product!, { Color: 'Purple' }).variant).toEqual(
      laterVariant,
    );
  });
});
