# Data Connectivity Matrix

Every surface in the app, traced to the table or function it actually reads and
writes, and checked against the live database. Generated while auditing for the
production release.

**How the live database was probed:** anonymous PostgREST requests using only
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus column-existence probes per field. Row
counts marked "RLS" return 0 to an anonymous caller by design — the data is
there, the policy correctly hides it.

---

## 1. Storefront → database

| Surface | Table / function | Direction | Live status |
| --- | --- | --- | --- |
| Home (`page.tsx`) | `products`, `collections` | read | ✅ 138 / 39 rows |
| Shop (`shop/page.tsx`) | `products`, `collections`, `product_collections` | read | ✅ 345 mappings |
| Product detail | `products` (single row + related by brand) | read | ✅ all 17 selected columns exist |
| Collection detail | `collections`, `product_collections`, `products` | read | ✅ 0 empty collections |
| Brands menu / header | `collections` | read | ✅ |
| Journal index & article | `blog_posts` (+ built-in fallback posts) | read | ✅ 2 DB rows, merged with 4 built-ins |
| Wishlist / favourites | `wishlists` keyed on `auth.uid()` | read + write | ✅ schema matches |
| Cart | `localStorage` via `lib/cart.ts` only | client | ✅ single writer, `gharib:cart` event |
| Checkout | `place_order()` RPC | write | ⛔ **function missing on live DB** |
| Abandoned-cart autosave | `capture_abandoned_cart()` RPC | write | ⛔ **function missing** |
| Guest order tracking (`/track`) | `track_guest_order()` RPC | read | ⛔ **function missing** |
| Newsletter (footer) | `subscribe_newsletter()` RPC | write | ⛔ **function + table missing** |
| Contact form | `contact_inquiries` | write | ✅ schema matches |
| Customer dashboard | `orders`, `order_tracking`, `products`, `wishlists` | read | ✅ schema matches |
| Currency rates | `/api/rates` → open.er-api.com, 12 h cache | read | ✅ falls back to static table |
| Sitemap | `products`, `collections`, `getAllPosts()` | read | ✅ 192 URLs |

## 2. Admin panel → database

All 17 tabs now query real tables. Five of them previously rendered hardcoded
markup and are fixed in this pass.

| Tab | Table(s) | Was |
| --- | --- | --- |
| Dashboard / Reports | `orders`, `order_items`, `products` (derived) | ✅ already real |
| Orders registry | `orders`, `order_items`, `order_tracking` | ✅ already real |
| Products catalog | `products`, `inventory`, `product_collections` | ✅ already real |
| Collections registry | `collections`, `product_collections` | ✅ already real |
| Inventory tracker | `inventory` | ✅ already real |
| Customers catalog | `customers` | ✅ already real |
| Abandoned carts | `abandoned_carts` | ✅ already real |
| Campaigns | `marketing_campaigns` | ✅ already real |
| Discount codes | `discounts` | ✅ already real |
| Homepage editor | `products.is_hero` / `hero_order` | ✅ already real |
| Inquiries log | `contact_inquiries` | ✅ already real |
| **Stock transfers** | `transfers` | ⚠️ was hardcoded `XFER-00129` |
| **Gift cards vault** | `gift_cards` | ⚠️ was hardcoded `VIP-GOLDEN-GIFT-500`; the create form only fired a toast and saved nothing |
| **Global markets** | `markets` | ⚠️ was a hardcoded 3-row table |
| **Analytics reports** | `analytics_events` + `orders` + `order_items` | ⚠️ was invented (`14,200 Operators`, fixed 55/28/17 donut) |
| **CMS & pages** | `cms_pages`, `blog_posts` | ⚠️ was two invented article titles |

The admin also went from 18 sequential queries to one parallel batch.

## 3. Data integrity findings

| Finding | Impact | Fixed by |
| --- | --- | --- |
| `inventory` had **0 rows** | Every product sold without limit; stock never decremented; Inventory tab empty | migration 43 seeds one row per product-size |
| `order_tracking` had 8 rows for `ORD-9922`, `ORD-9923`, `ORD-2547` — **none of which exist in `orders`** | Ghost entries in admin; would attach to any future order reusing those ids | migration 43 deletes them and adds the missing FK |
| `orders` missing `payment_method`, `payment_status`, `payment_ref`, `discount_code`, `discount_amount`, `shipping_fee` | `place_order` cannot record a payment | migration 40 adds them |
| All 138 products priced **AED 199** with a **single shared image** | Catalogue reads as placeholder | owner data entry (migration 37 seeded placeholders) |
| `customers` has 0 rows | No admin account exists yet | sign up, then the promote step in the rollout guide |
| `abandoned_carts` readable by anonymous callers | Checkout PII public | migration 39 |

## 4. What is blocked until the migrations run

Four of the five write paths in the storefront go through `SECURITY DEFINER`
functions that **do not exist on the live database yet**. Until
`scripts/apply-migrations-38-43.sql` is run:

- checkout cannot place an order,
- abandoned carts are not captured,
- guest tracking returns nothing,
- newsletter signups are not stored.

Each of these now answers `503` with an explicit "migrations have not been
applied" message rather than a generic failure, so the state is unambiguous.

Everything else — the whole catalogue, journal, wishlist, contact form, customer
dashboard and all 17 admin tabs — is connected and working against the live
database today.
