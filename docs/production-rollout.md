# Production Rollout — Security & Server-Component Release

This release converts every page to server components, locks down the database,
and makes checkout server-authoritative (COD only). **The app code and database
migrations 38–42 must go live together** — the old client-side order inserts stop
working the moment the new RLS policies apply, and the new checkout needs the
`place_order()` function.

> **Status (re-verified against the live database, 4 August 2026): migrations
> 38–42 ARE applied.** `place_order`, `subscribe_newsletter` and
> `track_guest_order` all exist and respond; an anonymous insert into `orders`
> is refused with `42501` (row-level security); anonymous reads of `orders` and
> `abandoned_carts` return nothing. A real cash-on-delivery order (`ORD-10001`)
> was placed end-to-end against production to confirm it.
>
> An earlier version of this block claimed the opposite. It was stale, and it
> was wrong in the alarming direction — treat a live probe as the authority over
> this file, not the other way round. **Do not diagnose from this paragraph;
> re-probe.**
>
> Still outstanding: migration **43** (seeds `inventory`) could not be confirmed
> from outside, because RLS correctly hides that table from the public key — an
> anonymous count returns zero whether the table is empty or simply invisible.
> Check the admin Inventory tab; if it is empty, apply 43. Migration **44**
> (`44_launch_hardening.sql`) is new and must be applied — it stores the
> customer's phone on the order, moves free delivery to AED 300, and adds
> discount pre-validation, server-side contact submission and rate limiting.
>
> Whenever a migration has not been applied, `/api/checkout`, `/api/track` and
> `/api/newsletter` answer `503` with an explicit "migrations have not been
> applied" message rather than a bare 500, so that state is easy to spot.

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
| `CART_RECOVERY_SECRET` | for cart recovery | must equal `app_config.cart_recovery` in the database (migration 45). Unset, no recovery emails are sent and nothing else changes — see §5a |

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

## 5a. Growth features (migrations 45–46)

Three additions, shipped together. Two of them need nothing but the migration;
the first also needs a secret and a scheduler.

### Abandoned-cart recovery emails

Carts have been captured since migration 12 and never read back out. Migration
**45** adds the recovery state, and `POST /api/cart-recovery` does the sending —
three reminders per cart, at **1 hour**, **24 hours** and **72 hours** after the
shopper last touched it (`src/app/lib/cart-recovery.ts`; change a delay there and
it takes effect on the next run, no migration needed).

To switch it on:

1. Apply `45_abandoned_cart_recovery.sql`.
2. Generate the job secret and store it (the SQL is in the operations note at the
   foot of that file), then set the same value as `CART_RECOVERY_SECRET` in the
   environment and redeploy. **Both are required.** The claim function returns
   customer PII, so it refuses to run on the anon key alone — until the two
   match, the endpoint answers `401` and nothing sends.
3. Schedule it hourly. Any scheduler will do:

   ```
   curl -X POST https://<your-domain>/api/cart-recovery \
        -H "Authorization: Bearer $CART_RECOVERY_SECRET"
   ```

Notes worth knowing before you turn it on:

- **Every cart already in the table is exempt, permanently.** Applying 45 opts
  out everything that exists at that moment, so the first run cannot mail months
  of history about selections nobody remembers. Recovery starts from carts
  abandoned afterwards.
- A shopper who abandoned three times gets **one** reminder, about their most
  recent cart, and anyone who has since placed an order is skipped.
- A cart is stamped as reminded the moment it is claimed, so a run that crashes
  half way skips a reminder rather than repeating one. Anything Resend refuses is
  handed straight back to the queue.
- Each run handles at most 20 carts per stage. A run that fills its batch says so
  in the response and the log; the next hourly run takes the rest.
- Every reminder carries an unsubscribe link (`/recover/stop`), which asks before
  it acts — a one-click GET would let mail scanners unsubscribe people who never
  saw the message.
- The admin's **Abandoned Carts** tab has a **Send due reminders** button that
  runs the same job by hand, and each row shows how many reminders it has had.

The restore link in the email lands on `/recover?token=…`, which puts the
selection back in the bag — **merged**, so a shopper who has added something
since does not lose it. It deliberately restores only the items and does not
prefill the address: a recovery link can be forwarded or sit in a shared inbox,
and a home address is not worth that risk for one saved form field.

### Free-delivery progress nudge

`src/app/components/FreeDeliveryProgress.tsx`, shown in the cart drawer and the
checkout summary: *"Add AED 101 more for complimentary delivery"*, with a hairline
progress rule. No migration. It reads `lib/shipping.ts`, which mirrors
`place_order()` — so it can never promise a threshold checkout does not honour.

### Fragrance finder quiz

`/discover` — four questions, three recommendations, linked from the main nav as
**Find your scent**. The matching (`src/app/lib/quiz.ts`) runs on catalogue data
that already exists: `olfactory_group`, `tags` and the three note arrays seeded in
migration 37. Nothing to write, and no new product columns.

Migration **46** captures what the quiz is worth commercially: the answers, and
the email if one is offered. The email ask sits **after** the results, never in
front of them, and asking for it actually sends the three — a promise to email
something must be kept. Addresses land in `newsletter_subscribers` with
`source = 'quiz'`, so there is still one list.

Once it has been live a week, the queries at the foot of migration 46 tell you
which family people reach for and what your capture rate is.

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
6. `POST /api/cart-recovery` with no `Authorization` header returns **401**, and
   with the correct bearer token returns `{"ok":true,...}`. Then abandon a
   checkout with an address you can read and call it with `?minAgeMinutes=0` —
   the reminder should arrive, and running it again immediately should send
   nothing.
7. `/discover` returns three recommendations for any set of answers, and the
   cart drawer shows the gap to complimentary delivery on a single-bottle bag.

### A note on `loading.tsx`

There is deliberately **no** `src/app/loading.tsx`. A root loading file wraps every
route in a Suspense boundary, which makes Next.js flush a `200` before the page
resolves — so `notFound()` on `/product/[id]`, `/collection/[id]` and
`/blogs/[slug]` could only ever produce a soft 404, which is exactly the SEO
problem this release set out to fix. Loading boundaries live only on `/shop` and
`/collections`, which never call `notFound()`. A `loading.tsx` also covers child
segments, which is why `/blogs` has none: it would re-break `/blogs/[slug]`.
