# Screenshots & media

Drop PNG/GIF captures here and reference them from the root `README.md`'s
[Screenshots](../../README.md#screenshots) section (the section is currently
an HTML comment — uncomment it and fill in the paths once these exist).

Capture against **demo mode** (`npm start` with an unfilled `.env`) so the
shots are reproducible by anyone and never leak a real store's catalog. Prefer
a phone-sized device/simulator frame, light appearance unless noted, and
crop/scale to a consistent width (~1170px is a good default for a Retina
phone shot).

## Naming convention

`docs/media/<name>.png` (or `.gif` for a flow), referenced in the README as
`docs/media/<name>.png`. Suggested set:

| File | Screen / flow |
| --- | --- |
| `home.png` | Home — hero, collections, featured products |
| `shop.png` | Shop tab |
| `collection.png` | Collection grid (sort visible) |
| `search.png` | Search with results, or the idle state with recent-search chips |
| `product.png` | Product detail — carousel + variant picker |
| `cart.png` | Cart — line items, discount code field, checkout button |
| `checkout.png` | Shopify Checkout Sheet, mid-flow |
| `account.png` | Account tab (signed in) |
| `saved.png` | Saved items (wishlist) grid |
| `dark-mode.png` | Any screen above in dark appearance, for contrast |
| `checkout-flow.gif` | Full flow: product → add to cart → checkout → order confirmed |

Not every file is required before launch — a partial set (Home, Product, Cart,
Checkout) covers the README well. Add the rest as they're captured.
