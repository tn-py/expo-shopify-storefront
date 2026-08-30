import {
  getAvailableOptionValues,
  resolveVariantSelection,
} from '@/components/commerce/variant-selection';
import type { Product, ProductVariant } from '@/shopify/types';

const image = { url: 'https://example.com/shirt.jpg', altText: 'Shirt', width: 800, height: 800 };
const money = { amount: '20.00', currencyCode: 'USD' };

function variant(
  id: string,
  color: string,
  size: string,
  availableForSale = true,
): ProductVariant {
  return {
    id,
    title: `${color} / ${size}`,
    availableForSale,
    price: money,
    compareAtPrice: null,
    selectedOptions: [
      { name: 'Color', value: color },
      { name: 'Size', value: size },
    ],
    image,
    sku: id,
  };
}

const product: Product = {
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
  options: [
    { id: 'color', name: 'Color', values: ['Red', 'Blue'] },
    { id: 'size', name: 'Size', values: ['Small', 'Large'] },
  ],
  variants: {
    nodes: [
      variant('red-small', 'Red', 'Small'),
      variant('red-large', 'Red', 'Large', false),
      variant('blue-large', 'Blue', 'Large'),
    ],
  },
  tags: [],
};

describe('variant selection', () => {
  it('resolves an empty initial selection to the first available real variant', () => {
    expect(resolveVariantSelection(product, {})).toEqual({
      selection: { Color: 'Red', Size: 'Small' },
      variant: product.variants.nodes[0],
    });
  });

  it('repairs an impossible option combination atomically', () => {
    expect(resolveVariantSelection(product, { Color: 'Blue', Size: 'Small' })).toEqual({
      selection: { Color: 'Blue', Size: 'Large' },
      variant: product.variants.nodes[2],
    });
  });

  it('uses earlier option choices to disable impossible later values without trapping selection', () => {
    expect(getAvailableOptionValues(product, { Color: 'Red', Size: 'Small' }, 'Size')).toEqual(
      new Set(['Small']),
    );
    expect(getAvailableOptionValues(product, { Color: 'Red', Size: 'Small' }, 'Color')).toEqual(
      new Set(['Red', 'Blue']),
    );
  });
});
