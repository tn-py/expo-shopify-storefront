/** Hand-written subset of the Storefront API schema for the shapes this app reads. */

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface ShopImage {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice: Money | null;
  selectedOptions: { name: string; value: string }[];
  image: ShopImage | null;
  sku: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
  values: string[];
}

export interface ProductCard {
  id: string;
  handle: string;
  title: string;
  vendor: string | null;
  featuredImage: ShopImage | null;
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  compareAtPriceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  availableForSale: boolean;
}

export interface Product extends ProductCard {
  description: string;
  descriptionHtml: string;
  images: { nodes: ShopImage[] };
  options: ProductOption[];
  variants: { nodes: ProductVariant[] };
  tags: string[];
}

export interface CollectionCard {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: ShopImage | null;
}

export interface Connection<T> {
  nodes: T[];
  pageInfo: PageInfo;
}

/* ---- Cart ---- */

export interface CartLine {
  id: string;
  quantity: number;
  cost: { totalAmount: Money; amountPerQuantity: Money };
  merchandise: {
    id: string;
    title: string;
    image: ShopImage | null;
    product: { handle: string; title: string };
    selectedOptions: { name: string; value: string }[];
    price: Money;
  };
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money | null;
  };
  lines: { nodes: CartLine[] };
}

export type ProductSortKey =
  | 'BEST_SELLING'
  | 'PRICE'
  | 'CREATED'
  | 'TITLE'
  | 'RELEVANCE';
