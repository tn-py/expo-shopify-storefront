/** GraphQL operations for the Storefront API, as template strings. */

const MONEY = `
  fragment Money on MoneyV2 {
    amount
    currencyCode
  }
`;

const IMAGE = `
  fragment Image on Image {
    url
    altText
    width
    height
  }
`;

const PRODUCT_CARD = `
  fragment ProductCard on Product {
    id
    handle
    title
    vendor
    availableForSale
    featuredImage { ...Image }
    priceRange {
      minVariantPrice { ...Money }
      maxVariantPrice { ...Money }
    }
    compareAtPriceRange {
      minVariantPrice { ...Money }
      maxVariantPrice { ...Money }
    }
  }
`;

const CART = `
  fragment Cart on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { ...Money }
      totalAmount { ...Money }
      totalTaxAmount { ...Money }
    }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost {
          totalAmount { ...Money }
          amountPerQuantity { ...Money }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            price { ...Money }
            image { ...Image }
            selectedOptions { name value }
            product { handle title }
          }
        }
      }
    }
  }
`;

export const SHOP_QUERY = `
  query Shop {
    shop {
      name
      description
      primaryDomain { url }
      brand {
        logo { image { ...Image } }
        colors {
          primary { background foreground }
          secondary { background foreground }
        }
      }
    }
  }
  ${IMAGE}
`;

export const COLLECTIONS_QUERY = `
  query Collections($first: Int = 30) {
    collections(first: $first, sortKey: TITLE) {
      nodes {
        id
        handle
        title
        description
        image { ...Image }
      }
    }
  }
  ${IMAGE}
`;

export const COLLECTION_QUERY = `
  query Collection(
    $handle: String!
    $first: Int = 20
    $after: String
    $sortKey: ProductCollectionSortKeys = COLLECTION_DEFAULT
    $reverse: Boolean = false
    $filters: [ProductFilter!]
  ) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { ...Image }
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, filters: $filters) {
        nodes { ...ProductCard }
        pageInfo { hasNextPage endCursor }
        filters {
          id
          label
          type
          values { id label count input }
        }
      }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_CARD}
`;

export const PRODUCTS_QUERY = `
  query Products($first: Int = 24) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes { ...ProductCard }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_CARD}
`;

export const PRODUCT_QUERY = `
  query Product($handle: String!) {
    product(handle: $handle) {
      ...ProductCard
      description
      descriptionHtml
      tags
      images(first: 12) { nodes { ...Image } }
      options { id name values }
      variants(first: 100) {
        nodes {
          id
          title
          availableForSale
          sku
          price { ...Money }
          compareAtPrice { ...Money }
          selectedOptions { name value }
          image { ...Image }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_CARD}
`;

export const PRODUCT_VARIANTS_QUERY = `
  query ProductVariants($handle: String!, $first: Int = 100, $after: String) {
    product(handle: $handle) {
      variants(first: $first, after: $after) {
        nodes {
          id
          title
          availableForSale
          sku
          price { ...Money }
          compareAtPrice { ...Money }
          selectedOptions { name value }
          image { ...Image }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
  ${MONEY}
  ${IMAGE}
`;

export const PREDICTIVE_SEARCH_QUERY = `
  query PredictiveSearch($query: String!) {
    predictiveSearch(query: $query, limit: 10, types: [PRODUCT, COLLECTION, QUERY]) {
      queries { text styledText }
      collections { id handle title image { ...Image } }
      products { ...ProductCard }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_CARD}
`;

export const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($query: String!, $first: Int = 20, $after: String) {
    search(query: $query, first: $first, after: $after, types: [PRODUCT]) {
      nodes { ...ProductCard }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_CARD}
`;

/* ---- Cart mutations ---- */

export const CART_CREATE = `
  mutation CartCreate($lines: [CartLineInput!], $buyerIdentity: CartBuyerIdentityInput) {
    cartCreate(input: { lines: $lines, buyerIdentity: $buyerIdentity }) {
      cart { ...Cart }
      userErrors { field message }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_QUERY = `
  query CartQuery($id: ID!) {
    cart(id: $id) { ...Cart }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_LINES_ADD = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...Cart }
      userErrors { field message }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_LINES_UPDATE = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...Cart }
      userErrors { field message }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_LINES_REMOVE = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...Cart }
      userErrors { field message }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_BUYER_IDENTITY_UPDATE = `
  mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart { ...Cart }
      userErrors { field message }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;
