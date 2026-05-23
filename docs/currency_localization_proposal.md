# Business Proposal & Technical Specification: Gharib Imperial Currency Engine

**Prepared for**: Partners of Gharib | Exquisite Luxury Fragrances  
**Subject**: Geolocation & Real-Time Currency Conversion System  
**Status**: Proposal (Pending Approval)

---

## 1. Executive Summary

As a luxury fragrance house rooted in Dubai, UAE, our operations, inventory, and ledgers are fundamentally managed in **UAE Dirhams (AED)**. However, to provide a world-class shopping experience for our global clientele, our digital boutique must feel local to every visitor.

We propose the implementation of the **Gharib Imperial Currency Engine**—an automated localization system that:
1. **Establishes UAE Dirhams (AED) as the Base Baseline**: Redefines all catalog prices, cart balances, and transactions in AED inside the database.
2. **Auto-Detects Visitor Origin**: Uses high-speed IP geolocation to instantly identify where the user is browsing from on their first visit.
3. **Retrieves Real-Time Exchange Rates**: Integrates a live, highly accurate financial exchange API to convert prices dynamically based on live market valuations.
4. **Maintains High-Fidelity UI Controls**: Adds a custom, gold-accented header selector allowing clients to manually override and select their preferred denomination.

---

## 2. Technical Architecture & Earning Math

To support live conversions with 100% accuracy, we will implement a multi-layered currency pipeline:

```mermaid
graph TD
    A[Visitor Enters Boutique] --> B[IP Geolocation Query]
    B --> C{Match Country Code?}
    C -- GCC Regions -- > D[Set SAR / QAR / KWD / BHD / OMR]
    C -- Americas / EU / UK -- > E[Set USD / EUR / GBP]
    C -- Others / Blocked -- > F[Graceful Default: AED]
    D & E & F --> G[Fetch Live Exchange Rates from API]
    G --> H[Convert Base AED Catalog Prices & Render UI]
```

### 2.1. Supported Local Currencies
We will support the following primary denominations natively with localized formatting:
* `🇦🇪 AED` (UAE Dirham - د.إ) ➔ **Baseline Base Currency (1.000)**
* `🇸🇦 SAR` (Saudi Riyal - ر.س) ➔ GCC Priority
* `🇶🇦 QAR` (Qatari Riyal - ر.ق) ➔ GCC Priority
* `🇰🇼 KWD` (Kuwaiti Dinar - د.ك) ➔ GCC Priority
* `🇧 BHD` (Bahraini Dinar - .د.ب) ➔ GCC Priority
* `🇴 OMR` (Omani Rial - ر.ع.) ➔ GCC Priority
* `🇺🇸 USD` (US Dollar - $) ➔ Global Standard
* `🇪🇺 EUR` (Euro - €) ➔ European Union
* `🇬🇧 GBP` (Great British Pound - £) ➔ United Kingdom
* `🇮🇳 INR` (Indian Rupee - ₹) ➔ South Asia

---

## 3. Real-Time Conversion & Geolocation Pipeline

### 3.1. Instant IP Geolocation (Auto-Adaptation)
When a user loads the storefront, a `useEffect` hook queries a fast, open-access geolocation API (e.g. `https://ipapi.co/json/`).
* **Input**: User's IP address (automatically resolved by API).
* **Output**: User's local country, continent, and default local currency code.
* **Match Logic**: If the currency code matches one of our supported options, we set it as the active session currency. If geolocation is blocked, we gracefully fall back to **AED**.

### 3.2. Market-Accurate Live Exchange Rates
To guarantee conversion accuracy, the engine queries the global financial exchange API on session start:
* **API Endpoint**: `https://open.er-api.com/v6/latest/AED` (A highly reliable, free-tier financial endpoint with hourly updates).
* **Caching Strategy**: Exchange rates are stored in client state and cached in `sessionStorage`. This prevents redundant API requests on page navigation, ensuring lag-free browsing.
* **Offline Backup Coefficients**: If the live API is unreachable or offline, the system utilizes high-fidelity static conversion parameters:
  - `AED` ➔ `1.000` (Base)
  - `USD` ➔ `0.2722` (Dirham to Dollar)
  - `EUR` ➔ `0.2514` (Dirham to Euro)
  - `GBP` ➔ `0.2154` (Dirham to Pound)
  - `SAR` ➔ `1.0208` (Dirham to Riyal)
  - `QAR` ➔ `0.9912`
  - `KWD` ➔ `0.0838`
  - `INR` ➔ `22.68`

---

## 4. UI/UX Specifications

We will overhaul the storefront and checkout screens to integrate the currency engine.

### 4.1. Centralized Currency Utility Hook
We will write a centralized formatting helper `formatCurrency(aedAmount, activeCurrency, exchangeRates)` that automatically converts the baseline AED pricing and returns a perfectly formatted localized currency string:
```typescript
export const formatCurrency = (aedAmount: number, targetCurrency: string, rates: Record<string, number>) => {
  const rate = rates[targetCurrency] || 1.0;
  const converted = aedAmount * rate;
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: targetCurrency,
    minimumFractionDigits: ["AED", "SAR", "QAR"].includes(targetCurrency) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(converted);
};
```

### 4.2. Luxury Header Selector Dropdown
We will add a beautiful, gold-framed custom dropdown menu in the storefront header (next to the cart icon) and the footer:
* Renders the active country's flag and currency code (e.g. `🇦🇪 AED`, `🇸🇦 SAR`, `🇺🇸 USD`).
* On click, opens a clean, glassmorphic dropdown list of all supported currencies.
* Selecting an option instantly recalculates all pricing across the homepage catalog, cart drawers, and checkout screen with no page reload.

### 4.3. Checkout & Cart Consistency
* **Persistent Settings**: The selected currency is synced to `localStorage` (e.g., `gharib_active_currency`) so that checkout automatically matches the storefront selection.
* **Frictionless Conversion**: The checkout order ledger displays item prices, shipping charges, and total investment converted accurately into the client's local denomination.
* **Order Sync**: Final orders are recorded in the database in **AED** alongside a metadata tag specifying the currency and exchange rate utilized (e.g., `{ converted_total: "$326.80", currency: "USD", rate: 0.272 }`), keeping admin sales statistics uniform.

---

## 5. Proposed Changes

We will implement this in the following files:

### 5.1. Database Baseline Updates
#### [NEW] [17_base_currency_to_aed.sql](file:///Users/shahidshamir/Desktop/dubai-perfume/supabase/migrations/17_base_currency_to_aed.sql)
Redefines product pricing inside the PostgreSQL tables from USD values directly to UAE Dirhams (AED):
* gold-memoir (101): `745.00 AED` (equivalent to ~$203 USD)
* enchanted-blooms (102): `437.00 AED` (equivalent to ~$119 USD)
* mystic-oud (103): `620.00 AED` (equivalent to ~$169 USD)
* ocean-breeze (104): `532.00 AED` (equivalent to ~$145 USD)
* Oud for greatness (1): `1215.00 AED` (equivalent to ~$331 USD)
* Tom Ford Lost Cherry (5): `1196.00 AED` (equivalent to ~$326 USD)
* Tom Ford Lost Cherry sizes, orders, and ledger seeds are converted similarly.

---

### 5.2. Frontend Application Components

#### [MODIFY] [supabase.ts](file:///Users/shahidshamir/Desktop/dubai-perfume/src/app/lib/supabase.ts)
* Update `SEED_PRODUCTS` in mock client to reflect the new AED baseline prices.

#### [MODIFY] [page.tsx (Storefront)](file:///Users/shahidshamir/Desktop/dubai-perfume/src/app/page.tsx)
* Add live currency rate query hook inside the initial page `useEffect`.
* Query IP geolocation on client load and set default currency.
* Add custom premium header and footer Currency Selector Dropdowns.
* Modify all product price renders and cart drawer aggregations to utilize `formatCurrency`.

#### [MODIFY] [page.tsx (Checkout)](file:///Users/shahidshamir/Desktop/dubai-perfume/src/app/checkout/page.tsx)
* Retrieve `activeCurrency` and cached `exchangeRates` from storage.
* Render subtotal, shipping, and totals in the selected converted currency.
* Save order parameters securely in base AED, appending metadata regarding the conversion rate for administrative bookkeeping.

#### [MODIFY] [page.tsx (Admin Dashboard)](file:///Users/shahidshamir/Desktop/dubai-perfume/src/app/admin/page.tsx)
* Ensure admin totals and metrics are calculated uniformly in AED (base), while rendering the transaction ledger with clear indicators of the converted customer currencies.

---

## 6. Verification Plan

### 6.1. Automated Verification
* Verify build compile states (`npm run build`) to ensure TypeScript parameters are strictly correct.

### 6.2. Manual Verification
1. **Automated Geolocation Check**:
   - Load the homepage. Verify the geolocator queries your local origin and defaults to your local currency (or AED if outside supported regions).
2. **Real-Time API Integrity**:
   - Verify pricing is retrieved dynamically from `open.er-api.com`. Temporarily block the network connection and verify it falls back smoothly to static backup rates.
3. **Manual Dropdown Switching**:
   - Click the header selector, change from `AED` to `USD` or `SAR`.
   - Verify every price on the page, the detail modal, and the cart slide-over recalculates instantly.
4. **Checkout Reconciliation**:
   - Complete checkout in `USD` or `SAR`. Verify totals format correctly, order creates successfully, and the database stores the transaction accurately in base AED.

---

## 7. Approval & Next Steps

**Please review the technical specification and let me know if you and your partners approve this blueprint to begin implementation.**
