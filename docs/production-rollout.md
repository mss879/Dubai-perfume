# Production Rollout — Security & Server-Component Release

This release converts every page to server components, locks down the database,
and makes checkout server-authoritative (COD only). **The app code and database
migrations 38–42 must go live together** — the old client-side order inserts stop
working the moment the new RLS policies apply, and the new checkout needs the
`place_order()` function.

> **Status check (verified against the live database):** migrations 38–42 are
> **not applied yet**. `track_guest_order` and `subscribe_newsletter` return
> PGRST202, and an anonymous request with only the public anon key can still
> read `abandoned_carts` — i.e. checkout PII (names, emails, phone numbers,
> addresses) is world-readable **right now**. Applying migration 39 is the fix
> and is the most urgent item in this document.
>
> Until the migrations are applied, `/api/checkout`, `/api/track` and
> `/api/newsletter` answer `503` with an explicit "migrations have not been
> applied" message rather than a bare 500, so this state is easy to spot.

## 1. Apply migrations (in order, via the Supabase SQL editor)

**Fastest path:** open `scripts/apply-migrations-38-43.sql`, paste the whole file
into the Supabase SQL editor, and run it once. It is migrations 38–43
concatenated in order and is safe to re-run. Regenerate it after adding a
migration with `bash scripts/build-migration-bundle.sh`.

The individual files, for reference:

| File | What it does |
| --- | --- |
| `supabase/migrations/38_fix_admin_trust.sql` | Signup can no longer self-grant admin; removes the `admin@gharib.com` hijack and the delete-by-email behavior |
| `supabase/migrations/39_rls_lockdown.sql` | Removes anonymous read/write on abandoned carts (PII), orders, order items, order tracking, and merchandising; blocks users from flipping their own `is_admin` |
| `supabase/migrations/40_order_integrity.sql` | Sequential order numbers, payment/discount columns, and the `place_order` / `capture_abandoned_cart` / `track_guest_order` functions (server-priced totals, stock decrement, discount redemption) |
| `supabase/migrations/41_newsletter_subscribers.sql` | Newsletter table + `subscribe_newsletter` function |
| `supabase/migrations/42_order_lifecycle_and_provisioning.sql` | Fixes signup orphaning a customer row on an email clash (which silently broke `is_admin` and every owner-scoped policy); maintains `customers.total_spent` / `orders_count`; aligns the order status vocabulary; makes the payment method a validated `place_order` argument |
| `supabase/migrations/43_seed_operational_data.sql` | Deletes 8 orphaned `order_tracking` rows pointing at orders that do not exist (and adds the missing foreign key); seeds `inventory`, which was completely empty — so until now no order decremented stock and the Inventory tab showed nothing |

Note: migrations 31–37 may still be pending as well (37 is the catalogue reseed —
it **wipes all products and customer wishlists** and seeds 138 products at
placeholder AED 199 with a placeholder bottle image). Apply everything in
numeric order.

## 2. Promote your admin account (once, after 38 and 42 are applied)

Sign up normally through the storefront with the email you want to use, then run
in the SQL editor:

```sql
UPDATE public.customers SET is_admin = TRUE WHERE email = '<your-email>';
```

Email substrings no longer grant admin; this flag is the only path. It is checked
server-side before any admin markup is rendered, and again by RLS on every query.

## 3. Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | production builds now fail loudly without it (no silent mock store) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | same |
| `NEXT_PUBLIC_SITE_URL` | recommended | canonical origin for SEO metadata/sitemap; defaults to `https://gharibperfumes.com` |
| `NEXT_PUBLIC_TRADE_LICENCE` | recommended | UAE trade licence number shown on `/terms`. Left unset, the page omits the claim rather than printing a placeholder |
| `RESEND_API_KEY` | for email | from resend.com/api-keys. Without it the store runs normally but sends no notifications; every skipped send is logged |
| `RESEND_FROM_EMAIL` | for email | e.g. `Gharib <orders@gharibperfumes.com>`. **The domain must be verified in Resend** or delivery is rejected |
| `RESEND_REPLY_TO` | optional | where customer replies land |

No service-role key is needed: the trusted order path runs inside `SECURITY
DEFINER` database functions.

## 3a. Customer notifications

Three transactional emails, all sent server-side so `RESEND_API_KEY` never
reaches the browser:

| Trigger | Email | Sent from |
| --- | --- | --- |
| Order placed | Confirmation with itemised order and "payment on delivery" note | `POST /api/checkout`, after the order is committed |
| Admin sets **Out for delivery** | "Out for delivery" with the courier tracking number and the amount to have ready | `POST /api/admin/order-status` |
| Admin sets **Delivered** | "Your order has arrived", with a 48-hour window to flag problems | `POST /api/admin/order-status` |

Marking an order **out for delivery** now opens a modal that requires a tracking
number — the API rejects the status change without one, because the number is
what makes the dispatch email useful. It is written to `orders.tracking_number`,
included in the email, added to the order timeline, and shown on `/track`.

Sending is deliberately fail-soft: if Resend is down or unconfigured, the order
is still placed and the status still changes. Failures are logged, and the admin
toast says whether the customer was notified.

Order status changes no longer happen straight from the browser. They go through
`/api/admin/order-status`, which re-checks `customers.is_admin` server-side — so
the notification cannot be bypassed by whoever changed the status.

## 4. What changed operationally

- **Checkout is cash-on-delivery only.** The card form (which was collecting
  card details and discarding them) is gone, along with the untrue "encrypted
  payment" claims. When a payment gateway is approved, it plugs into
  `src/app/lib/payments/` + a webhook route without reworking checkout — the
  provider now genuinely feeds `place_order`, and the database validates the
  (method, payment status) pair so a client cannot declare an order paid.
- Orders decrement inventory, redeem discount codes, and roll up into
  `customers.total_spent` / `orders_count`; totals are computed in the database
  from catalogue prices.
- **Guest order tracking** lives at `/track` and needs the order number **and**
  the order email. It is linked from the order confirmation and the footer.
- Newsletter signups land in `newsletter_subscribers`. Both the shared footer
  and the homepage now use the same wired form — the homepage previously
  discarded the address and thanked the shopper anyway.
- `/admin` is gated by the server: `src/proxy.ts` does the optimistic cookie
  check and refreshes the session, and `src/app/lib/auth.ts` performs the
  authoritative `customers.is_admin` lookup in **both** the protected layout and
  the protected page (a layout alone is not re-rendered on every navigation).

## 5. Stock tracking — read before your first sale

`place_order` only enforces stock for `(product_id, size)` pairs that **have** an
inventory row. A product with no row is treated as not stock-tracked and always
sells. Most of the catalogue has no inventory rows today, so "inventory is
decremented" applies only to products you have actually stocked in the admin
Inventory Tracker.

Migration 42 deliberately does not invent stock levels. The footer of that file
carries a ready-to-run statement for seeding a baseline once you know your real
counts.

## 6. Post-deploy smoke checks

1. Anonymous PostgREST reads of `abandoned_carts` / `order_tracking` with the
   anon key return zero rows; anonymous inserts into `orders` fail.
2. `/admin` with no session returns `307` to `/admin/signin` and no admin markup
   appears in the response body; a non-admin account is rejected with an error.
3. Place a COD test order end-to-end: sequential `ORD-1xxxx` id, correct totals,
   inventory decremented, abandoned cart marked converted, and the customer's
   `total_spent` / `orders_count` incremented.
4. `curl` a product page: title, price, and Product JSON-LD appear in the HTML
   source; an unknown product id returns HTTP **404** (not a 200 soft-404).
5. `https://<site>/sitemap.xml` and `/robots.txt` resolve; the sitemap lists both
   database articles and the built-in editorial posts.

### A note on `loading.tsx`

There is deliberately **no** `src/app/loading.tsx`. A root loading file wraps every
route in a Suspense boundary, which makes Next.js flush a `200` before the page
resolves — so `notFound()` on `/product/[id]`, `/collection/[id]` and
`/blogs/[slug]` could only ever produce a soft 404, which is exactly the SEO
problem this release set out to fix. Loading boundaries live only on `/shop` and
`/collections`, which never call `notFound()`. A `loading.tsx` also covers child
segments, which is why `/blogs` has none: it would re-break `/blogs/[slug]`.
