# Shopify setup

Everything the app needs from the Shopify side. Budget ~15 minutes.

## 1. Storefront API access token (required)

1. Shopify admin → **Settings → Apps and sales channels → Develop apps**.
2. **Create an app** (name it e.g. "Mobile app"). Open it → **Configuration** →
   **Storefront API** → **Configure**.
3. Enable these scopes:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_inventory`
   - `unauthenticated_read_product_tags`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_checkouts`
   - `unauthenticated_read_content`
4. **Install** the app. Under **API credentials** copy the
   **Storefront API access token** (public — safe to ship in the bundle).
5. Put it in `.env`:
   ```
   EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
   EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   Use the permanent `*.myshopify.com` domain, not a custom domain.

## 2. Products, collections & publication

The Home screen lists **collections**; make sure you have a few, each with
products. Products must be **published to the sales channel** tied to your
Storefront API app — setting a product to *Active* is not enough. If products
don't appear, check **Product → Publishing** and the app's channel/publication.

Brand logo on the Home screen is pulled automatically from
**Settings → Brand → Logos**; without one the store name is shown as text.

## 3. Customer Account API (optional)

For sign-in / order history / addresses. See
[customer-accounts.md](./customer-accounts.md). In short:

1. Shopify admin → **Settings → Customer accounts** — enable new customer
   accounts.
2. Open the **Customer Account API** / Headless application setup, copy the
   **Client ID** and the **auth base URL**
   (`https://shopify.com/authentication/<shop-id>`).
3. Add the callback URI `shop.<shop-id>.app://callback`.
4. Fill `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` and
   `EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_API_URL` in `.env`, then rebuild the dev
   client.

## 4. Checkout

No setup — the app opens `cart.checkoutUrl` in Shopify's native Checkout Sheet
Kit, so payments, taxes, discounts and checkout extensions all run on Shopify.
For local testing enable **Bogus Gateway** (Settings → Payments → test mode) and
use test card `1`.

## 5. Development stores

A Shopify **development store** always has storefront password protection on and
it can't be disabled. The Checkout Sheet will show the password page first — enter
it once and the in-app webview remembers it for the session.
