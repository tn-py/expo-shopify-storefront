import {
  resolveHomeSections,
  type StorefrontUIConfig,
} from '@/config/storefront-ui';
import type { CollectionCard, ProductCard } from '@/shopify/types';

const image = { url: 'https://example.com/image.jpg', altText: null, width: 800, height: 800 };
const money = { amount: '20.00', currencyCode: 'USD' };

const collections: CollectionCard[] = [
  { id: 'collection-1', handle: 'new', title: 'New', description: '', image },
  { id: 'collection-2', handle: 'sale', title: 'Sale', description: '', image },
];

const products: ProductCard[] = [
  {
    id: 'product-1',
    handle: 'linen-shirt',
    title: 'Linen shirt',
    vendor: null,
    featuredImage: image,
    priceRange: { minVariantPrice: money, maxVariantPrice: money },
    compareAtPriceRange: { minVariantPrice: money, maxVariantPrice: money },
    availableForSale: true,
  },
];

describe('storefront UI configuration', () => {
  it('falls back to available Shopify collections when configured handles are missing', () => {
    const config: StorefrontUIConfig = {
      home: {
        sections: [
          { type: 'collections', title: 'Featured collections', handles: ['missing'], limit: 1 },
        ],
      },
    };

    expect(resolveHomeSections(config, { collections, products: [] })).toEqual([
      {
        type: 'collections',
        title: 'Featured collections',
        collections: [collections[0]],
      },
    ]);
  });

  it('hides data-backed sections when Shopify has no graceful fallback', () => {
    const config: StorefrontUIConfig = {
      home: {
        sections: [
          { type: 'announcement', text: '   ' },
          { type: 'products', title: 'Staff picks', handles: ['missing'] },
          { type: 'collections', title: 'Shop', handles: ['missing'] },
          { type: 'trust', items: [] },
        ],
      },
    };

    expect(resolveHomeSections(config, { collections: [], products: [] })).toEqual([]);
  });

  it('keeps configured merchandising order while resolving matching Shopify products', () => {
    const config: StorefrontUIConfig = {
      home: {
        sections: [
          { type: 'hero', title: 'Made for every day', action: { label: 'Shop now', href: '/shop' } },
          { type: 'products', title: 'Staff picks', handles: ['linen-shirt'], limit: 4 },
        ],
      },
    };

    expect(resolveHomeSections(config, { collections, products })).toEqual([
      { type: 'hero', title: 'Made for every day', action: { label: 'Shop now', href: '/shop' } },
      { type: 'products', title: 'Staff picks', products },
    ]);
  });
});
