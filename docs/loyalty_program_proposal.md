# Business Proposal & Technical Specification: Gharib Imperial Club Loyalty Program

**Prepared for**: Partners of Gharib | Exquisite Luxury Fragrances  
**Subject**: Storefront Checkout Conversion & Customer Retention Strategy  
**Status**: Proposal (Pending Approval)

---

## 1. Executive Summary

To elevate brand loyalty and maximize customer lifetime value (LTV), we propose the launch of the **Gharib Imperial Club**—an ultra-premium, tier-based loyalty program. 

The primary business goals are to:
1. **Drive Account Registration**: Prompt guest users to seamlessly register accounts during the checkout process by linking point accumulation directly to their purchase.
2. **Increase Repeat Purchase Frequency**: Incentivize repeat purchases by unlocking higher-status tiers with superior cash-back reward rates as customer lifetime spend accumulates.
3. **Enhance Brand Value**: Deliver a high-end, visual loyalty experience (prestige membership cards, progress tracking, and detailed scent point ledgers) that aligns with Gharib's majestic luxury branding.

---

## 2. Core Program Architecture

The program relies on lifetime spend milestones to unlock membership tiers. Higher tiers reward customers with a larger cash-back percentage returned on their fragrance investments.

### 2.1. Membership Tiers & Reward Rates

| Tier Status | Lifetime Spend Threshold | Points Accrued per $1 Spent | Points Earned per $100 Spent | Cash-Back Value per $100 Spent | Effective Reward Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Imperial Member** | `$0 - $999.99` (Entry) | `1.0 pt` | `100 pts` | `$1.00` | **1.0%** |
| **Imperial Bronze** | `$1,000 - $4,999.99` | `1.5 pts` | `150 pts` | `$1.50` | **1.5%** |
| **Imperial Silver** | `$5,000 - $9,999.99` | `2.3 pts` | `230 pts` | `$2.30` | **2.3%** |
| **Imperial Gold** | `> $10,000` | `4.0 pts` | `400 pts` | `$4.00` | **4.0%** |

### 2.2. Earning & Redemption Math
To ensure simple, clean calculations for both the customer and the database, we translate cash-back percentages into a unified point system:
* **Point Redemption Value**: **100 Points = $1.00 Discount**
* **Accrual Multiplier**: Point earning rates scale with the user's tier multiplier:
  * **Imperial Member**: 1.0x points per $1 spent ($100 spent = 100 points = $1.00 reward value).
  * **Imperial Bronze**: 1.5x points per $1 spent ($100 spent = 150 points = $1.50 reward value).
  * **Imperial Silver**: 2.3x points per $1 spent ($100 spent = 230 points = $2.30 reward value).
  * **Imperial Gold**: 4.0x points per $1 spent ($100 spent = 400 points = $4.00 reward value).

---

## 3. Customer Acquisition Flow (Checkout Account Hook)

To eliminate sign-up friction, we introduce a **seamless auto-registration hook** directly in the checkout process.

```mermaid
graph TD
    A[Guest Checkout] --> B{Enters Password in Contact Info?}
    B -- Yes -- > C[Place Order & Auto-Create Account]
    C --> D[Link Order to Profile]
    C --> E[Points Accrued to Account]
    B -- No -- > F[Standard Guest Checkout]
```

### 3.1. Checkout Integration
1. **Friction-Free Sign-up Banner**: If a user checks out as a guest, an elegant gold-bordered module appears in the checkout form:
   > ✦ **Accrue Loyalty Points on this Checkout**
   > Join the exclusive *Gharib Imperial Club* to track your scent history and start earning up to 4.0% back on your luxury fragrance investments. 
   > Simply type a password below to auto-create your account today.
2. **One-Step Account Creation**: Entering a password auto-registers the customer using their checkout email, phone, and name during checkout validation.
3. **Instant Points Credit**: Points from the current order are calculated based on the purchase amount and credited immediately to their new profile.

---

## 4. Premium Customer Experience

Once logged in, members access their personal **Imperial Club Loyalty Portal** inside their customer dashboard.

### 4.1. Visual Features
* **Prestige Glassmorphic Card**: A glowing digital member card matching their tier status (Bronze, Silver, Gold, or Entry Member) with HSL gradients, displaying their name, current points balance, and cash-back value.
* **Tier Progression Stepper**: A gold line showing progress to the next luxury tier (e.g. *"Invest $250 more to unlock Imperial Bronze"*).
* **Accrual Ledger Table**: A historical grid detailing all points earned or spent (e.g. `+370 pts (Purchase Award - ORD-9923)`, `-500 pts (Redeemed on Checkout - ORD-9931)`).
* **Imperial Perks Grid**: Clear, visually striking grid outlining privileges unlocked at each milestone.

---

## 5. Administrative Control Panels

Administrators can monitor and manage the loyalty ecosystem inside the `/admin` portal:
* **Customer Catalog Metrics**: Displays active loyalty points and membership tiers for each profile.
* **Manual Adjustments Console**: Administrators can manually add or deduct points with a custom explanation (e.g., customer service goodwill, private event credit) which logs directly into the client's point ledger.

---

## 6. Technical Architecture & Database Design

The system runs on a secure PostgreSQL database schema with fully automated recalculation triggers.

### 6.1. Database Migration (16_loyalty_program.sql)
We will run a clean database migration:
1. **Table Schema Extensions (`public.customers`)**:
   - Add `loyalty_points` (INTEGER, Default: 0)
   - Add `loyalty_tier` (VARCHAR(50), Default: 'Imperial Member')
2. **New Loyalty Ledger Table (`public.loyalty_ledger`)**:
   Tracks the detailed point transaction history:
   - `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - `customer_id` UUID REFERENCES public.customers(id) ON DELETE CASCADE
   - `points_change` INTEGER NOT NULL (Positive for earns, Negative for redemptions)
   - `reason` VARCHAR(255) NOT NULL
   - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
3. **Automated Sync Trigger (`on_order_placed_sync_loyalty`)**:
   Fires `AFTER INSERT` on `public.orders`. If the order is linked to a customer ID:
   - Increments the customer's `total_spent` and `orders_count`.
   - Computes the customer's new tier based on their cumulative lifetime spend:
     - Spend `< $1,000` ➔ Tier: `Imperial Member` (Earning Multiplier: 1.0x)
     - Spend `$1,000 - $4,999.99` ➔ Tier: `Imperial Bronze` (Earning Multiplier: 1.5x)
     - Spend `$5,000 - $9,999.99` ➔ Tier: `Imperial Silver` (Earning Multiplier: 2.3x)
     - Spend `> $10,000` ➔ Tier: `Imperial Gold` (Earning Multiplier: 4.0x)
   - Calculates point accruals based on the order's price and active tier points multiplier.
   - Automatically writes a credit transaction to `loyalty_ledger`.
   - Updates the customer's point balance and tier level.

### 6.2. Offline Sandbox Mock Database (supabase.ts)
To ensure immediate testability even without a live database connection:
* Mirror the tier-recalc logic inside `clientSafeSupabase` mock handler.
* Sync local-storage mock database blocks for customer points, order inserts, and ledger transactions.

---

## 7. Next Steps & Approval

To proceed with building these components:
1. Stage the PostgreSQL database migration (`16_loyalty_program.sql`).
2. Integrate the mock schema changes inside `supabase.ts`.
3. Overhaul checkout sign-up inputs and member points redemptions.
4. Render the Imperial Club dashboard layout.
5. Deploy admin adjustment interfaces.

**Please review and confirm your approval to execute this plan.**
