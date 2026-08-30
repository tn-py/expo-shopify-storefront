import { fireEvent, render } from '@testing-library/react-native';

import { CollectionCard } from '@/components/commerce/collection-card';
import { ProductCard } from '@/components/commerce/product-card';
import { ProductOptionSelector } from '@/components/commerce/product-option-selector';
import { CatalogSkeleton } from '@/components/commerce/catalog-skeleton';
import { ServiceDisclosure } from '@/components/commerce/service-disclosure';
import type { CollectionCard as CollectionCardData, Product } from '@/shopify/types';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const image = { url: 'https://example.com/item.jpg', altText: 'Item', width: 800, height: 800 };
const money = { amount: '20.00', currencyCode: 'USD' };
const collection: CollectionCardData = {
  id: 'collection-1',
  handle: 'new',
  title: 'New arrivals',
  description: 'Freshly selected pieces for the season.',
  image,
};
const product: Product = {
  id: 'product-1',
  handle: 'shirt',
  title: 'Everyday shirt',
  vendor: 'Studio',
  featuredImage: image,
  priceRange: { minVariantPrice: money, maxVariantPrice: money },
  compareAtPriceRange: {
    minVariantPrice: { amount: '25.00', currencyCode: 'USD' },
    maxVariantPrice: { amount: '25.00', currencyCode: 'USD' },
  },
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
      {
        id: 'red-small',
        title: 'Red / Small',
        availableForSale: true,
        price: money,
        compareAtPrice: null,
        selectedOptions: [
          { name: 'Color', value: 'Red' },
          { name: 'Size', value: 'Small' },
        ],
        image,
        sku: 'RS',
      },
      {
        id: 'blue-large',
        title: 'Blue / Large',
        availableForSale: true,
        price: money,
        compareAtPrice: null,
        selectedOptions: [
          { name: 'Color', value: 'Blue' },
          { name: 'Size', value: 'Large' },
        ],
        image,
        sku: 'BL',
      },
    ],
  },
  tags: [],
};

describe('shared commerce components', () => {
  it('exposes product cards as descriptive touch-safe links', async () => {
    const { getByRole, getByText } = await render(<ProductCard product={product} />);

    expect(getByRole('link', { name: 'Everyday shirt, $20.00, on sale' })).toHaveStyle({
      minHeight: 44,
    });
    expect(getByText('Sale')).toBeOnTheScreen();
  });

  it('supports long collection descriptions without changing the link contract', async () => {
    const { getByRole, getByText } = await render(<CollectionCard collection={collection} />);

    expect(getByRole('link', { name: 'New arrivals' })).toHaveStyle({ minHeight: 44 });
    expect(getByText(collection.description)).toBeOnTheScreen();
  });

  it('marks impossible product option values disabled and submits possible values', async () => {
    const onChange = jest.fn();
    const { getByRole } = await render(
      <ProductOptionSelector
        product={product}
        selection={{ Color: 'Red', Size: 'Small' }}
        onChange={onChange}
      />,
    );

    expect(getByRole('button', { name: 'Small' })).toBeSelected();
    expect(getByRole('button', { name: 'Large' })).toBeDisabled();
    await fireEvent.press(getByRole('button', { name: 'Blue' }));
    expect(onChange).toHaveBeenCalledWith('Color', 'Blue');
  });

  it('exposes loading skeletons as a single named progress state', async () => {
    const { getByRole } = await render(<CatalogSkeleton label="Loading search results" />);

    expect(getByRole('progressbar', { name: 'Loading search results' })).toBeOnTheScreen();
  });

  it('expands long service content with accessible disclosure state', async () => {
    const body = 'Shipping timing and return eligibility are confirmed during checkout.';
    const { getByRole, getByText, queryByText } = await render(
      <ServiceDisclosure title="Shipping & returns" body={body} />,
    );

    const disclosure = getByRole('button', { name: 'Shipping & returns' });
    expect(disclosure).toHaveProp('accessibilityState', { expanded: false });
    expect(queryByText(body)).toBeNull();
    await fireEvent.press(disclosure);
    expect(getByText(body)).toBeOnTheScreen();
    expect(disclosure).toHaveProp('accessibilityState', { expanded: true });
  });
});
