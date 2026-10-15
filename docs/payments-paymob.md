# Online payment — Paymob (UAE)

How the store takes card, Apple Pay and Google Pay payments through **Paymob
Unified Checkout**, how to switch it on, and what to do when something needs a
human. Everything here is already built; this page is the owner's runbook.

## How it works (one paragraph)

At checkout the order is created **awaiting payment**. It holds its stock and
discount for about 70 minutes. The shopper is sent to Paymob's hosted payment
page (`uae.checkout.paymob.com`), where card details are entered — they never
touch this site. Paymob then tells the server the result in two ways:

- **Webhook:** a callback signed with HMAC-SHA512.
- **Inquiry:** an authenticated server-to-server lookup.

The order becomes **paid** only from one of those, never from anything the
browser says. Confirmation emails go out at that moment. An order that is never
paid is released automatically, and its stock and discount come back.

| Piece | Where |
| --- | --- |
| Database (tables, RLS, all payment logic) | `supabase/migrations/63_paymob_payments.sql` |
| Paymob client, HMAC, orchestration | `src/app/lib/payments/paymob/` |
| Webhook (Paymob → store) | `POST /api/payments/paymob/webhook` |
| Shopper's payment page | `/checkout/payment/<token>` (+ fallback `/checkout/payment`) |
| Payment check job | `POST /api/payments/reconcile`, scheduled by `netlify/functions/payments-reconcile.mts` |
| Admin | Orders tab → **Online payment — Paymob** panel; each order's invoice has a payment section with Refund / Void |

## 1. Set it up (in this order)

### 1.1 Run the migration
Run `supabase/migrations/63_paymob_payments.sql` in the Supabase SQL editor.

Nothing changes for shoppers yet: the store stays on cash on delivery until you
switch it.

### 1.2 Create the database half of the payment secret
In the SQL editor:

```sql
INSERT INTO public.app_config (name, value)
VALUES ('payments', replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', ''))
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

SELECT value FROM public.app_config WHERE name = 'payments';
```

Copy the value it shows; it becomes `PAYMENTS_RPC_SECRET`. It lets the server
mark orders paid, so:

- keep it out of chats and tickets;
- if it ever leaks, run the `INSERT` again and update the variable.

### 1.3 Collect the Paymob values
In the Paymob dashboard (UAE), with the **Test** toggle on to begin with:

| Variable | Where in Paymob |
| --- | --- |
| `PAYMOB_SECRET_KEY` | Settings → API Keys → Secret key |
| `PAYMOB_PUBLIC_KEY` | Settings → API Keys → Public key |
| `PAYMOB_API_KEY` | Settings → API Keys → API key (same in test and live) |
| `PAYMOB_HMAC_SECRET` | Settings → API Keys → HMAC secret (only the **main** account user sees it) |
| `PAYMOB_INTEGRATION_IDS` | Settings → Payment Integrations — the IDs, comma-separated (card; in live also Apple Pay / Google Pay) |

You also generate one value yourself:

| Variable | Value |
| --- | --- |
| `PAYMENTS_CRON_SECRET` | 64 random characters, e.g. `openssl rand -hex 32` |

Optional:

- `PAYMOB_MERCHANT_ID` adds an extra check on every callback.
- `PAYMOB_HMAC_SECRET_PREVIOUS` is only used during a rotation (section 4).

Add them all in **Netlify → Site configuration → Environment variables**, for
every scope (Builds and Functions), then redeploy. All of them are server-only.

### 1.4 Point Paymob at the store
On **every** integration ID (card, Apple Pay, Google Pay), open it under
Settings → Payment Integrations and set:

- **Webhook URL:** `https://<your domain>/api/payments/paymob/webhook`
- **Redirect URL:** `https://<your domain>/checkout/payment`

The admin panel shows both URLs, ready to copy. Card payments also pass these
per payment, but wallets rely on the integration's own setting.

In **Checkout Customization**, keep these **off**:

- **Split Payments**, **Convenience fee** and **Save card**: they change the
  amount or the callback, and the store would flag every such payment for
  review.
- **Payment retries**, ideally: the store offers its own "Try again".

Add your logo, colours and fonts there so the page matches the maison.

### 1.5 Check, then switch
Admin → Orders → **Online payment — Paymob** → **Setup**. Every chip should be
green:

- **Keys:** TEST
- **Database secret:** OK
- **Scheduler:** SET

Then press **Switch to online payment**. From this moment:

- checkout takes payment online only;
- `place_order` refuses cash on delivery, even when called directly.

## 2. Test before going live

On the (locked) live site, with the preview cookie, using **test** keys:

1. Place an order and pay with test card **5123 4567 8901 2346**, expiry
   **01/39**, CVV **123**, name **Test Account**.
2. You land on the order's payment page, which shows **Thank you**.
3. Admin → Orders: the order shows **Paid online**, the invoice shows the card's
   last four, and a **Payment received** line appears in the timeline.
4. The customer confirmation and the owner's new-order email arrive (owner's
   says *paid — nothing to collect*).
5. In the invoice, **Refund** part of it. The order shows **Partially
   refunded**, and the customer gets a refund email.
6. Place another order and press Back on Paymob's page. The order's payment
   page offers **Pay now** and **Change my order**. **Change my order** puts the
   bag back and releases the stock.
7. Place another order and abandon it. After about 70 minutes plus the next
   10-minute check it is released (**Payment window closed**) and its stock is
   back.
8. Press **Check payments now** in the admin panel. It reports what it checked.

Paymob documents no "decline" test card; ask your account manager if you want
to test a decline.

## 3. Go live

Paymob reviews the integration (their "technical approval") and then issues
live credentials. Then:

1. Replace `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY` and
   `PAYMOB_INTEGRATION_IDS` with the **Live** values. Live and test can never be
   mixed.
2. Check the HMAC secret is still the same.
3. Redeploy.
4. Set the webhook and redirect URLs on the **live** integration IDs too
   (step 1.4).
5. The admin panel should now show **Keys: LIVE**.
6. Make one small real purchase and refund it.

## 4. Day to day

**Orders.** A paid online order behaves like any other: accept, pack, dispatch,
deliver. The admin panel will not let an order be accepted, packed or shipped
until Paymob has confirmed its payment. An unpaid order releases itself; you
never cancel it by hand.

**Refunds and voids.** Do them from the order's invoice (Refund, full or
partial; Void, same business day only).

- The store and Paymob stay in step, and the customer is emailed.
- A refund made in Paymob's dashboard is picked up as well, through the webhook
  and the 10-minute check.
- If a refund comes back as **outcome unknown**, check the transaction in
  Paymob's dashboard before trying again. The store will update itself once
  Paymob reports it.
- **Disputes / chargebacks:** ask Paymob before refunding a disputed payment.
  Refunding and then losing the dispute can cost the amount twice.

**Attention flags** (an amber mark in the orders list; details in the invoice;
the owner is emailed once):

| Flag | What happened | What to do |
| --- | --- | --- |
| Paid twice | Two successful payments on one order | Refund the extra one (its own row in the invoice) |
| Paid after the order was released | Money arrived after the window closed; stock was already returned | Refund, or fulfil by hand if the stock is still there |
| Paid a different amount | Paymob reported a different amount or currency | The order was **not** marked paid; refund it in Paymob |
| Paid through an unconfigured payment method | Integration ID not in `PAYMOB_INTEGRATION_IDS` | Add the ID if it is yours (then **Check payments now**), or refund |
| Authorised but not captured | An auth/capture integration was used | Capture or void it in Paymob; use sale integrations |

**Rotating the HMAC secret.**

1. Put the old secret in `PAYMOB_HMAC_SECRET_PREVIOUS` and the new one in
   `PAYMOB_HMAC_SECRET`, then redeploy.
2. A day later, remove `_PREVIOUS`.

**Switching back to cash on delivery.** Use the same panel. If it is for more
than a short outage, also remove the Paymob variables and redeploy, so the
footer and legal pages say cash on delivery again: storefront copy follows the
deployment's configuration.

**Scheduler.** The 10-minute check is a Netlify Scheduled Function, and it runs
on published production deploys only. Without it, three things still work:

- webhooks still mark orders paid;
- the payment page still checks with Paymob;
- you can press **Check payments now**.

Expiry of abandoned orders, however, then waits for a manual check. On another
host, call:

```sh
curl -X POST https://<domain>/api/payments/reconcile -H "Authorization: Bearer $PAYMENTS_CRON_SECRET"
```

## 5. Troubleshooting

- **Checkout says secure payment is unavailable.** The store is in online mode
  but the variables or the database secret are wrong. The admin panel's
  **Setup** lists exactly which variable names are missing or unusable.
- **Paid at Paymob but the order still says awaiting payment.** The webhook did
  not arrive or did not verify. **Check payments now** (or simply the shopper
  reloading their payment page) asks Paymob directly and fixes it.
- **Repeated webhook rejections.** The HMAC secret is wrong, or the integration
  ID is not in `PAYMOB_INTEGRATION_IDS`. Paymob's wizard
  (`wizard.paymob.com`) has an HMAC troubleshooter, and `hooks.paymob.com`
  shows what Paymob sends. Point a **test** integration at it, never a live one.
- **Nothing is logged on purpose.** The payment code prints nothing: no
  payloads, keys or customer data. Failures are kept as short codes on the
  payment rows, visible to admins (`sync_error_code`, `email_error_code`,
  attempt `error_code`).

## 6. Security model (for reviewers)

**Secrets**
- Server-only.
- The public key is shape-checked so a secret key can never end up in a URL.
- The Paymob hosts are constants, not configuration.

**Webhook**
- Checks run in this order: strict JSON types and formats first (closing
  field-boundary sliding in the separator-less signed string), then the
  configured integration IDs (and optional merchant ID), then HMAC-SHA512
  compared in constant time, with the previous secret accepted during rotation.
- An unverified callback changes nothing. At most it triggers a throttled
  inquiry to Paymob.

**What is trusted**
- Fields the HMAC does not cover (refunded amount, parent transaction, gateway
  message) are only ever taken from Paymob's authenticated API.
- The amount always comes from the database order. A payment must match the
  attempt's amount and currency (AED) or it is flagged, not counted.

**Database**
- No service-role key.
- Every payment function needs the payment secret, checked in the database.
  The new tables are readable by admins only and writable by nobody directly.
- `verify_job_secret` is no longer callable from the API.
- Exactly-once: the transaction id is a primary key; awaiting → paid is a
  compare-and-set under a row lock; side effects and emails happen once (with
  Resend idempotency keys).
- Concurrent webhooks, polls and the job were tested to produce exactly one
  sale.
- Releases restock exactly what was reserved, in a global lock order, so they
  cannot deadlock with new orders.

**Shopper's payment page**
- Its 256-bit token is stored only as a hash.
- It reveals no personal data and is `noindex` / `no-referrer`.
- Paymob's query string is ignored and stripped.

**Admin money routes**
- Need an admin session and a same-origin JSON request.
- Refunds take an idempotency key and one open request per order.
