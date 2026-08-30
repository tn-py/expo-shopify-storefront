import type { CollectionCard, ProductCard } from '@/shopify/types';

export type StorefrontRoute =
  | '/shop'
  | '/search'
  | `/collection/${string}`
  | `/product/${string}`;

export type HomeSectionConfig =
  | { type: 'announcement'; text: string }
  | {
      type: 'hero';
      title: string;
      body?: string;
      imageUrl?: string;
      action?: { label: string; href: StorefrontRoute };
    }
  | { type: 'collections'; title: string; handles?: string[]; limit?: number }
  | { type: 'products'; title: string; handles?: string[]; limit?: number }
  | { type: 'trust'; title?: string; items: { title: string; body?: string }[] };

export interface StorefrontUIConfig {
  home: { sections: HomeSectionConfig[] };
  product?: {
    services?: { title: string; body: string }[];
  };
}

export type ResolvedHomeSection =
  | Extract<HomeSectionConfig, { type: 'announcement' | 'hero' | 'trust' }>
  | { type: 'collections'; title: string; collections: CollectionCard[] }
  | { type: 'products'; title: string; products: ProductCard[] };

export const storefrontUIConfig: StorefrontUIConfig = {
  home: {
    sections: [
      {
        type: 'hero',
        title: 'Designed for everyday living',
        body: 'Explore considered essentials selected for quality and lasting use.',
        action: { label: 'Shop all collections', href: '/shop' },
      },
      { type: 'collections', title: 'Shop by collection', limit: 6 },
      { type: 'products', title: 'Featured products', limit: 8 },
      {
        type: 'trust',
        title: 'Shop with confidence',
        items: [
          { title: 'Secure checkout', body: 'Payments are completed securely through Shopify.' },
          { title: 'Customer support', body: 'Questions are welcome before and after your order.' },
        ],
      },
    ],
  },
  product: {
    services: [
      { title: 'Shipping & returns', body: 'Shipping and return details are confirmed at checkout.' },
      { title: 'Product care', body: 'Follow the care guidance included with your item.' },
    ],
  },
};

function resolveByHandle<T extends { handle: string }>(
  available: T[],
  handles: string[] | undefined,
  limit: number | undefined,
): T[] {
  const safeLimit = Math.max(0, limit ?? available.length);
  if (!handles?.length) return available.slice(0, safeLimit);

  const byHandle = new Map(available.map((item) => [item.handle, item]));
  const selectedHandles = new Set<string>();
  const configured = handles.flatMap((handle) => {
    if (selectedHandles.has(handle)) return [];
    const item = byHandle.get(handle);
    if (!item) return [];
    selectedHandles.add(handle);
    return [item];
  });
  const fallback = available.filter((item) => {
    if (selectedHandles.has(item.handle)) return false;
    selectedHandles.add(item.handle);
    return true;
  });
  return [...configured, ...fallback].slice(0, safeLimit);
}

export function resolveHomeSections(
  config: StorefrontUIConfig,
  data: { collections: CollectionCard[]; products: ProductCard[] },
): ResolvedHomeSection[] {
  return config.home.sections.flatMap<ResolvedHomeSection>((section) => {
    if (section.type === 'announcement') {
      return section.text.trim() ? [{ ...section, text: section.text.trim() }] : [];
    }
    if (section.type === 'hero') {
      return section.title.trim() ? [section] : [];
    }
    if (section.type === 'trust') {
      const items = section.items.filter((item) => item.title.trim().length > 0);
      return items.length ? [{ ...section, items }] : [];
    }
    if (section.type === 'collections') {
      const collections = resolveByHandle(data.collections, section.handles, section.limit);
      return collections.length ? [{ type: section.type, title: section.title, collections }] : [];
    }

    const products = resolveByHandle(data.products, section.handles, section.limit);
    return products.length ? [{ type: section.type, title: section.title, products }] : [];
  });
}
