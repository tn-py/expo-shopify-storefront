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

const CART_DISCOUNT_ALLOCATION = `
  fragment CartDiscountAllocation on CartDiscountAllocation {
    discountedAmount { ...Money }
    ... on CartCodeDiscountAllocation { code }
    ... on CartAutomaticDiscountAllocation { title }
  }
`;

// Taxes aren't selected — they're calculated (and shown) in Shopify Checkout,
// not the cart. `warnings` surfaces non-blocking issues (e.g. a quantity
// Shopify capped for stock) and is only meaningful on mutation payloads, so
// it's spread into each mutation below rather than into this fragment.
const CART = `
  fragment Cart on Cart {
    id
    checkoutUrl
    totalQuantity
    buyerIdentity { email countryCode }
    discountCodes { code applicable }
    discountAllocations { ...CartDiscountAllocation }
    cost {
      subtotalAmount { ...Money }
      totalAmount { ...Money }
    }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost {
          totalAmount { ...Money }
          amountPerQuantity { ...Money }
        }
        discountAllocations { ...CartDiscountAllocation }
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
  ${CART_DISCOUNT_ALLOCATION}
`;

const CART_WARNINGS = `warnings { code message target }`;

export const SHOP_QUERY = `
  query Shop($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
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
  query Collections($first: Int = 30, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
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
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
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
  query Products($first: Int = 24, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes { ...ProductCard }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_CARD}
`;

export const PRODUCT_QUERY = `
  query Product($handle: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
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
  query ProductVariants(
    $handle: String!
    $first: Int = 100
    $after: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
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
  query PredictiveSearch($query: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
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
  query SearchProducts(
    $query: String!
    $first: Int = 20
    $after: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    search(query: $query, first: $first, after: $after, types: [PRODUCT]) {
      nodes { ...ProductCard }
      pageInfo { hasNextPage endCursor }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_CARD}
`;

export const PRODUCT_RECOMMENDATIONS_QUERY = `
  query ProductRecommendations($productId: ID!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    productRecommendations(productId: $productId, intent: RELATED) {
      ...ProductCard
    }
  }
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_CARD}
`;

/** Refreshes saved-for-later product cards from Shopify's current catalog. */
export const WISHLIST_PRODUCTS_QUERY = `
  query WishlistProducts($ids: [ID!]!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    nodes(ids: $ids) {
      ... on Product { ...ProductCard }
    }
  }
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_CARD}
`;

/* ---- Cart mutations ----
 * Every operation declares `$country`/`$language` and `@inContext` so prices
 * (and the discount amounts below) match the buyer's market — callers spread
 * `...inContextVariables()` into the request variables. */

export const CART_CREATE = `
  mutation CartCreate(
    $lines: [CartLineInput!]
    $buyerIdentity: CartBuyerIdentityInput
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartCreate(input: { lines: $lines, buyerIdentity: $buyerIdentity }) {
      cart { ...Cart }
      userErrors { field message }
      ${CART_WARNINGS}
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_QUERY = `
  query CartQuery($id: ID!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    cart(id: $id) { ...Cart }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_LINES_ADD = `
  mutation CartLinesAdd(
    $cartId: ID!
    $lines: [CartLineInput!]!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...Cart }
      userErrors { field message }
      ${CART_WARNINGS}
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_LINES_UPDATE = `
  mutation CartLinesUpdate(
    $cartId: ID!
    $lines: [CartLineUpdateInput!]!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...Cart }
      userErrors { field message }
      ${CART_WARNINGS}
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_LINES_REMOVE = `
  mutation CartLinesRemove(
    $cartId: ID!
    $lineIds: [ID!]!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...Cart }
      userErrors { field message }
      ${CART_WARNINGS}
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_BUYER_IDENTITY_UPDATE = `
  mutation CartBuyerIdentityUpdate(
    $cartId: ID!
    $buyerIdentity: CartBuyerIdentityInput!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart { ...Cart }
      userErrors { field message }
      ${CART_WARNINGS}
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;

export const CART_DISCOUNT_CODES_UPDATE = `
  mutation CartDiscountCodesUpdate(
    $cartId: ID!
    $discountCodes: [String!]
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
      cart { ...Cart }
      userErrors { field message }
      ${CART_WARNINGS}
    }
  }
  ${MONEY}
  ${IMAGE}
  ${CART}
`;
