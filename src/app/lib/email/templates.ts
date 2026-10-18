import "server-only";
import { SITE_URL, SITE_EMAIL } from "../site";
import { FREE_SHIPPING_THRESHOLD_AED } from "../shipping";
import { storefrontPaymentMode } from "../payments/mode";
import {
  recoveryStopUrl,
  recoveryUrl,
  type NormalizedRecoveryItem,
} from "../cart-recovery";

/**
 * Transactional email templates.
 *
 * Email clients strip <style> blocks and ignore most modern CSS, so these use
 * tables and inline styles only — no flexbox, no grid, no CSS variables. The
 * register still follows docs/design-system.md: serif display headings, wide
 * letter-spacing, hairline rules, black on white.
 */

export type OrderLine = {
  name: string;
  brand?: string | null;
  size?: string | null;
  quantity: number;
  unitPriceAed: number;
};

/**
 * How an order is paid. Absent means cash on delivery — every order placed
 * before online payment existed, and every order while the store is in COD
 * mode.
 */
export type OrderPaymentInfo = {
  /** "credit": paid in full by a gift card and/or loyalty points (migration 70). */
  method: "cod" | "paymob" | "credit";
  /** Card brand and last four only, e.g. "Mastercard ending 2346". */
  cardLabel?: string | null;
};

export type OrderEmailData = {
  orderId: string;
  customerName?: string | null;
  lines: OrderLine[];
  subtotalAed: number;
  shippingFeeAed: number;
  discountAed: number;
  totalAed: number;
  /** Cash on delivery only: added when the order is packed, collected on top of the total. */
  packingAed?: number;
  trackingNumber?: string | null;
  /** The courier's own tracking page (http/https only; checked by the order-status route). */
  trackingUrl?: string | null;
  payment?: OrderPaymentInfo | null;
  /** Migration 70: the gift wrap charge, and what loyalty points and a gift card paid. */
  giftWrapAed?: number;
  pointsAed?: number;
  giftCardAed?: number;
};

const paidOnline = (data: OrderEmailData) => data.payment?.method === "paymob";
/** Nothing is collected on delivery: paid online, or by a gift card and points. */
const paidInFull = (data: OrderEmailData) => paidOnline(data) || data.payment?.method === "credit";
const totalLabel = (data: OrderEmailData) =>
  paidOnline(data) ? "Total paid" : data.payment?.method === "credit" ? "Left to pay" : "Total due on delivery";
/** Packing, when the courier collects it (never on an order paid online). */
const packingOf = (data: OrderEmailData) => (paidInFull(data) ? 0 : Math.max(0, data.packingAed ?? 0));
/** What the customer pays in all: the total, plus packing for cash on delivery. */
const amountDueAed = (data: OrderEmailData) => data.totalAed + packingOf(data);

/** The shipping object as checkout posts it. Every field is optional. */
export type ShippingAddress = {
  name?: string | null;
  street?: string | null;
  city?: string | null;
  country?: string | null;
  postal_code?: string | null;
};

/** What the owner needs on top of the customer's copy: how to reach them. */
export type OwnerOrderEmailData = OrderEmailData & {
  customerEmail?: string | null;
  phone?: string | null;
  shipping?: ShippingAddress | null;
  /** Migration 70: what the packer needs for a gift (wrap, message, slip without prices). */
  giftNote?: { wrap: boolean; message: string | null; hidePrices: boolean } | null;
  /** Migration 70: sent to someone else. */
  recipient?: { name: string; phone: string | null; deliveryDate: string | null } | null;
};

export type NewsletterSignupData = {
  email: string;
  source?: string | null;
};

export type ContactInquiryData = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export const HAIRLINE = "#dcdcdc";
export const MUTED = "#646464";

export const aed = (n: number) =>
  `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function shell(opts: {
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Extra markup below the standard sign-off — an unsubscribe line, usually. */
  footerHtml?: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">

        <tr><td align="center" style="padding:40px 32px 28px;border-bottom:1px solid ${HAIRLINE};">
          <a href="${SITE_URL}" style="text-decoration:none;">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:0.28em;color:#000000;text-transform:uppercase;">Gharib</span>
          </a>
        </td></tr>

        <tr><td style="padding:40px 32px 8px;" align="center">
          <p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">${esc(opts.eyebrow)}</p>
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.35;letter-spacing:0.06em;text-transform:uppercase;color:#000000;font-weight:normal;">${esc(opts.heading)}</h1>
        </td></tr>

        <tr><td style="padding:22px 32px 0;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.8;color:#333333;">${opts.intro}</p>
        </td></tr>

        <tr><td style="padding:28px 32px 0;">${opts.bodyHtml}</td></tr>

        ${
          opts.ctaLabel && opts.ctaHref
            ? `<tr><td align="center" style="padding:34px 32px 8px;">
                 <a href="${opts.ctaHref}" style="display:inline-block;padding:14px 30px;background:#000000;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">${esc(opts.ctaLabel)}</a>
               </td></tr>`
            : ""
        }

        <tr><td style="padding:36px 32px 40px;">
          <div style="border-top:1px solid ${HAIRLINE};padding-top:22px;">
            <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${MUTED};">
              Questions? Reply to this message or write to
              <a href="mailto:${SITE_EMAIL}" style="color:#000000;">${SITE_EMAIL}</a>.
            </p>
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#909090;">
              Gharib Perfumes — Dubai, United Arab Emirates
            </p>
            ${opts.footerHtml ?? ""}
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function lineItemsTable(data: OrderEmailData): string {
  const rows = data.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${HAIRLINE};font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#000000;">
          ${esc([l.brand, l.name].filter(Boolean).join(" — "))}
          ${l.size ? `<br><span style="font-size:11px;color:${MUTED};">${esc(l.size)}</span>` : ""}
          <br><span style="font-size:11px;color:${MUTED};">Qty ${l.quantity}</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${HAIRLINE};font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#000000;white-space:nowrap;">
          ${l.unitPriceAed > 0 ? aed(l.unitPriceAed * l.quantity) : "Gift"}
        </td>
      </tr>`
    )
    .join("");

  const totalRow = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:${bold ? "14px 0 0" : "8px 0 0"};font-family:Helvetica,Arial,sans-serif;font-size:${bold ? "14px" : "13px"};color:${bold ? "#000000" : MUTED};${bold ? "letter-spacing:0.06em;text-transform:uppercase;" : ""}">${esc(label)}</td>
      <td align="right" style="padding:${bold ? "14px 0 0" : "8px 0 0"};font-family:Helvetica,Arial,sans-serif;font-size:${bold ? "14px" : "13px"};color:#000000;white-space:nowrap;">${esc(value)}</td>
    </tr>`;

  return `
    <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">Order ${esc(data.orderId)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows}
      ${totalRow("Subtotal", aed(data.subtotalAed))}
      ${data.discountAed > 0 ? totalRow("Savings", `− ${aed(data.discountAed)}`) : ""}
      ${totalRow("Delivery", data.shippingFeeAed > 0 ? aed(data.shippingFeeAed) : "Complimentary")}
      ${(data.giftWrapAed ?? 0) > 0 ? totalRow("Gift wrap", aed(data.giftWrapAed ?? 0)) : ""}
      ${(data.pointsAed ?? 0) > 0 ? totalRow("Points", `− ${aed(data.pointsAed ?? 0)}`) : ""}
      ${(data.giftCardAed ?? 0) > 0 ? totalRow("Gift card", `− ${aed(data.giftCardAed ?? 0)}`) : ""}
      ${packingOf(data) > 0 ? totalRow("Packing", aed(packingOf(data))) : ""}
      ${totalRow(totalLabel(data), aed(amountDueAed(data)), true)}
    </table>`;
}

function plainOrder(data: OrderEmailData): string {
  const items = data.lines
    .map((l) => `  - ${[l.brand, l.name].filter(Boolean).join(" ")}${l.size ? ` (${l.size})` : ""} x${l.quantity}  ${l.unitPriceAed > 0 ? aed(l.unitPriceAed * l.quantity) : "Gift"}`)
    .join("\n");
  return [
    `Order ${data.orderId}`,
    "",
    items,
    "",
    `Subtotal: ${aed(data.subtotalAed)}`,
    ...(data.discountAed > 0 ? [`Savings: -${aed(data.discountAed)}`] : []),
    `Delivery: ${data.shippingFeeAed > 0 ? aed(data.shippingFeeAed) : "Complimentary"}`,
    ...((data.giftWrapAed ?? 0) > 0 ? [`Gift wrap: ${aed(data.giftWrapAed ?? 0)}`] : []),
    ...((data.pointsAed ?? 0) > 0 ? [`Points: -${aed(data.pointsAed ?? 0)}`] : []),
    ...((data.giftCardAed ?? 0) > 0 ? [`Gift card: -${aed(data.giftCardAed ?? 0)}`] : []),
    ...(packingOf(data) > 0 ? [`Packing: ${aed(packingOf(data))}`] : []),
    `${totalLabel(data)}: ${aed(amountDueAed(data))}`,
  ].join("\n");
}

const greeting = (name?: string | null) =>
  name && name.trim() ? `Dear ${esc(name.trim())},` : "Hello,";

/* ── 1. Order placed ─────────────────────────────────────────────────────── */

export function orderConfirmationEmail(data: OrderEmailData) {
  const trackUrl = `${SITE_URL}/track?order=${encodeURIComponent(data.orderId)}`;
  const online = paidOnline(data);
  const credit = data.payment?.method === "credit";
  const card = data.payment?.cardLabel ? ` (${data.payment.cardLabel})` : "";
  return {
    subject: `Your Gharib order ${data.orderId} is confirmed`,
    html: shell({
      preheader: online
        ? `We have received your payment for order ${data.orderId}.`
        : credit
          ? `We have received order ${data.orderId}. It is paid in full.`
          : `We have received order ${data.orderId}. Payment is collected on delivery.`,
      eyebrow: "Order confirmed",
      heading: "Thank you for your order",
      intro: online
        ? `${greeting(data.customerName)} we have received your order and your payment${esc(card)}, and your order is now being prepared. <strong>It is paid in full</strong> — there is nothing to pay on delivery.`
        : credit
          ? `${greeting(data.customerName)} we have received your order and it is now being prepared. <strong>It is paid in full with your gift card and points</strong> — there is nothing to pay on delivery.`
          : `${greeting(data.customerName)} we have received your order and it is now being prepared. <strong>Payment is collected in cash or by card when your parcel arrives</strong> — nothing is charged before then.`,
      bodyHtml: lineItemsTable(data),
      ctaLabel: "Track your order",
      ctaHref: trackUrl,
    }),
    text: [
      greeting(data.customerName).replace(/<[^>]+>/g, ""),
      "",
      ...(online
        ? [
            `We have received your order and your payment${card}, and your order is now being prepared.`,
            "It is paid in full — there is nothing to pay on delivery.",
          ]
        : credit
          ? ["We have received your order and it is now being prepared.", "It is paid in full with your gift card and points: there is nothing to pay on delivery."]
          : [
            "We have received your order and it is now being prepared.",
            "Payment is collected in cash or by card when your parcel arrives.",
          ]),
      "",
      plainOrder(data),
      "",
      `Track your order: ${trackUrl}`,
      "(You will need your order number and this email address.)",
    ].join("\n"),
  };
}

/* ── 2. Out for delivery ─────────────────────────────────────────────────── */

export function outForDeliveryEmail(data: OrderEmailData) {
  const trackUrl = `${SITE_URL}/track?order=${encodeURIComponent(data.orderId)}`;
  const courierUrl = data.trackingUrl && /^https?:\/\//i.test(data.trackingUrl) ? data.trackingUrl : null;
  const courierLink = courierUrl
    ? `<p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;"><a href="${esc(courierUrl)}" style="color:#000000;text-decoration:underline;">Follow the parcel on the courier's site</a></p>`
    : "";
  const trackingBlock = data.trackingNumber || courierUrl
    ? `<div style="margin-top:24px;padding:18px 20px;background:#f5f5f5;">
         ${data.trackingNumber ? `<p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">Tracking number</p>
         <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;letter-spacing:0.08em;color:#000000;">${esc(data.trackingNumber)}</p>` : ""}
         ${courierLink}
       </div>`
    : "";

  return {
    subject: `Your Gharib order ${data.orderId} is out for delivery`,
    html: shell({
      preheader: `Order ${data.orderId} is with our courier.`,
      eyebrow: "On its way",
      heading: "Your order is out for delivery",
      intro: paidInFull(data)
        ? `${greeting(data.customerName)} your parcel is with our courier and on its way to you. It is paid in full, so there is nothing to pay on delivery.`
        : `${greeting(data.customerName)} your parcel is with our courier and on its way to you. Please have <strong>${aed(amountDueAed(data))}</strong> ready in cash, or a card for the courier's terminal.`,
      bodyHtml: trackingBlock + `<div style="margin-top:24px;">${lineItemsTable(data)}</div>`,
      ctaLabel: "Track your order",
      ctaHref: trackUrl,
    }),
    text: [
      greeting(data.customerName).replace(/<[^>]+>/g, ""),
      "",
      "Your parcel is with our courier and on its way to you.",
      paidInFull(data)
        ? "It is paid in full, so there is nothing to pay on delivery."
        : `Please have ${aed(amountDueAed(data))} ready in cash, or a card for the courier's terminal.`,
      ...(data.trackingNumber ? ["", `Tracking number: ${data.trackingNumber}`] : []),
      ...(courierUrl ? [`Courier tracking: ${courierUrl}`] : []),
      "",
      plainOrder(data),
      "",
      `Track your order: ${trackUrl}`,
    ].join("\n"),
  };
}

/* ── 3. Delivered ────────────────────────────────────────────────────────── */

export function orderDeliveredEmail(data: OrderEmailData) {
  return {
    subject: `Your Gharib order ${data.orderId} has been delivered`,
    html: shell({
      preheader: `Order ${data.orderId} was delivered.`,
      eyebrow: "Delivered",
      heading: "Your order has arrived",
      intro: `${greeting(data.customerName)} your order has been delivered. We hope it brings you pleasure. If anything is not as expected, reply within 48 hours and a client advisor will put it right.`,
      bodyHtml: lineItemsTable(data),
      ctaLabel: "Discover more",
      ctaHref: `${SITE_URL}/shop`,
    }),
    text: [
      greeting(data.customerName).replace(/<[^>]+>/g, ""),
      "",
      "Your order has been delivered. We hope it brings you pleasure.",
      "If anything is not as expected, reply within 48 hours and a client advisor will put it right.",
      "",
      plainOrder(data),
      "",
      `${SITE_URL}/shop`,
    ].join("\n"),
  };
}

/* ── 4. Abandoned-cart recovery ──────────────────────────────────────────── */

export type RecoveryEmailData = {
  /** 1, 2 or 3 — see RECOVERY_STAGES in lib/cart-recovery.ts. */
  stage: number;
  firstName?: string | null;
  items: NormalizedRecoveryItem[];
  subtotalAed: number;
  /** abandoned_carts.recovery_token — the credential in both links. */
  token: string;
  /** How the store takes payment now (the owner's switch); defaults to the deployment's setup. */
  paymentMode?: "online" | "cod";
  /** Migration 70, last reminder only: a single-use code made for this cart. */
  code?: { code: string; percent: number; endsAt: string | null; minOrder: number };
  /** Migration 70, last reminder only: a set that includes something they left. */
  bundle?: { title: string; priceAed: number; baseAed: number; names: string[]; url: string };
};

const reminderDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dubai" });

/** The last reminder's code and set suggestion (migration 70), when there are any. */
function reminderExtrasHtml(data: RecoveryEmailData): string {
  let html = "";
  if (data.code) {
    const until = data.code.endsAt ? ` until ${esc(reminderDate.format(new Date(data.code.endsAt)))}` : "";
    const min = data.code.minOrder > 0 ? ` on orders of ${esc(aed(data.code.minOrder))} or more` : "";
    html += `<div style="margin-top:26px;padding:22px;border:1px solid ${HAIRLINE};text-align:center;">
      <p style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">${esc(String(data.code.percent))}% off, just for you</p>
      <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:22px;letter-spacing:0.12em;color:#000000;">${esc(data.code.code)}</p>
      <p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${MUTED};">Use it once${min}${until}. Enter it at checkout with this email address.</p>
    </div>`;
  }
  if (data.bundle) {
    const saving = Math.max(0, data.bundle.baseAed - data.bundle.priceAed);
    html += `<div style="margin-top:22px;padding:20px 22px;background:#f5f5f5;">
      <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">Or complete the set</p>
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#000000;">${esc(data.bundle.title)}: ${esc(data.bundle.names.join(" + "))}</p>
      <p style="margin:6px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#333333;">${esc(aed(data.bundle.priceAed))}${saving > 0 ? ` <span style="color:${MUTED};text-decoration:line-through;">${esc(aed(data.bundle.baseAed))}</span>` : ""}
        &nbsp;<a href="${data.bundle.url}" style="color:#000000;">See the set</a></p>
    </div>`;
  }
  return html;
}

/**
 * The saved selection, priced. Deliberately not lineItemsTable(): there is no
 * order, no order number and no total due — quoting one would imply the
 * shopper owes money for a cart they never placed.
 */
function recoveryItemsTable(items: NormalizedRecoveryItem[], subtotalAed: number): string {
  const rows = items
    .map(
      (l) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${HAIRLINE};font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#000000;">
          ${esc([l.brand, l.name].filter(Boolean).join(" — "))}
          ${l.size ? `<br><span style="font-size:11px;color:${MUTED};">${esc(l.size)}</span>` : ""}
          ${l.quantity > 1 ? `<br><span style="font-size:11px;color:${MUTED};">Qty ${l.quantity}</span>` : ""}
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${HAIRLINE};font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#000000;white-space:nowrap;">
          ${l.unitPriceAed > 0 ? aed(l.unitPriceAed * l.quantity) : "Gift"}
        </td>
      </tr>`
    )
    .join("");

  return `
    <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">Your selection</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows}
      <tr>
        <td style="padding:14px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#000000;letter-spacing:0.06em;text-transform:uppercase;">Subtotal</td>
        <td align="right" style="padding:14px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#000000;white-space:nowrap;">${esc(aed(subtotalAed))}</td>
      </tr>
    </table>`;
}

/** A reassurance strip: the three things that stop a first order in the UAE. */
function reassuranceHtml(mode: "online" | "cod"): string {
  const line = (text: string) =>
    `<p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:#333333;">${text}</p>`;
  return `<div style="margin-top:26px;padding:20px 22px;background:#f5f5f5;">
    ${line(
      mode === "online"
        ? "<strong>Secure payment.</strong> Pay by card, Apple Pay or Google Pay on our payment partner&rsquo;s secure page."
        : "<strong>Pay on delivery.</strong> Nothing is charged before your parcel is in your hands."
    )}
    ${line(`<strong>Complimentary delivery</strong> on orders over ${esc(aed(FREE_SHIPPING_THRESHOLD_AED))}.`)}
    ${line("<strong>Two discovery samples</strong> accompany every order.")}
  </div>`;
}

const STAGE_COPY: Record<
  number,
  { eyebrow: string; heading: string; intro: (name: string) => string; cta: string; plain: string }
> = {
  1: {
    eyebrow: "Your selection",
    heading: "You left something with us",
    intro: (name) =>
      `${name} your selection is still here, exactly as you left it. Pick it up whenever suits you — one tap returns you to it.`,
    cta: "Return to your selection",
    plain: "Your selection is still here, exactly as you left it.",
  },
  2: {
    eyebrow: "Still available",
    heading: "Still thinking it over?",
    intro: (name) =>
      `${name} your selection is still waiting. If something gave you pause — the scent, the size, the delivery — reply to this message and a client advisor will answer personally.`,
    cta: "Return to your selection",
    plain:
      "Your selection is still waiting. If something gave you pause, reply to this message and a client advisor will answer personally.",
  },
  3: {
    eyebrow: "A last note",
    heading: "We will leave you in peace",
    intro: (name) =>
      `${name} this is the last we will write about this selection. It stays saved for a few days more, then quietly releases. If the moment is not right, we quite understand.`,
    cta: "Complete your order",
    plain:
      "This is the last we will write about this selection. It stays saved for a few days more, then quietly releases.",
  },
};

/**
 * A recovery reminder. Marketing mail, not transactional — hence the
 * unsubscribe line in the footer, which every stage carries.
 */
export function abandonedCartRecoveryEmail(data: RecoveryEmailData) {
  const copy = STAGE_COPY[data.stage] ?? STAGE_COPY[1];
  const paymentMode = data.paymentMode ?? storefrontPaymentMode();
  const name = (data.firstName ?? "").trim();
  const salutation = name ? `Dear ${esc(name)},` : "Hello,";
  const link = recoveryUrl(SITE_URL, data.token);
  const stopLink = recoveryStopUrl(SITE_URL, data.token);

  const leadItem = data.items[0];
  const subjectPiece = leadItem
    ? [leadItem.brand, leadItem.name].filter(Boolean).join(" ")
    : "your selection";

  const subject =
    data.stage === 3
      ? `A last note about ${subjectPiece}`
      : data.stage === 2
        ? `Still available — ${subjectPiece}`
        : `You left ${subjectPiece} with us`;

  return {
    subject,
    html: shell({
      preheader:
        paymentMode === "online"
          ? `${copy.plain} Secure payment at checkout.`
          : `${copy.plain} Payment is collected on delivery.`,
      eyebrow: copy.eyebrow,
      heading: copy.heading,
      intro: copy.intro(salutation),
      bodyHtml: recoveryItemsTable(data.items, data.subtotalAed) + reminderExtrasHtml(data) + reassuranceHtml(paymentMode),
      ctaLabel: copy.cta,
      ctaHref: link,
      footerHtml: `<p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#909090;">
        Would you rather not receive reminders about a saved selection?
        <a href="${stopLink}" style="color:#909090;">Stop these reminders</a>.
      </p>`,
    }),
    text: [
      salutation.replace(/<[^>]+>/g, ""),
      "",
      copy.plain,
      "",
      ...data.items.map(
        (l) =>
          `  - ${[l.brand, l.name].filter(Boolean).join(" ")}${l.size ? ` (${l.size})` : ""}${
            l.quantity > 1 ? ` x${l.quantity}` : ""
          }  ${aed(l.unitPriceAed * l.quantity)}`
      ),
      "",
      `Subtotal: ${aed(data.subtotalAed)}`,
      ...(data.code
        ? ["", `${data.code.percent}% off, just for you: ${data.code.code} (use it once, at checkout, with this email address).`]
        : []),
      ...(data.bundle ? ["", `Or complete the set: ${data.bundle.title}, ${aed(data.bundle.priceAed)}. ${data.bundle.url}`] : []),
      "",
      paymentMode === "online"
        ? "Secure payment by card, Apple Pay or Google Pay at checkout."
        : "Payment is collected on delivery — nothing is charged before your parcel arrives.",
      `Complimentary delivery on orders over ${aed(FREE_SHIPPING_THRESHOLD_AED)}.`,
      "",
      `${copy.cta}: ${link}`,
      "",
      `Stop these reminders: ${stopLink}`,
    ].join("\n"),
  };
}

/* ── 5. Fragrance finder results ─────────────────────────────────────────── */

export type QuizResultLine = {
  productId: number;
  brand: string | null;
  name: string;
  priceAed: number;
  /** Why the finder chose it — one sentence, already composed by lib/quiz. */
  reason: string;
};

export type QuizResultsEmailData = {
  lines: QuizResultLine[];
  /** The shopper's four answers, in their own words. */
  answers: string[];
};

/**
 * The three the finder named, sent because the shopper asked for them.
 *
 * The prices are read from the catalogue by the route, never from the browser —
 * an email quoting a price the store does not charge is worse than no email.
 */
export function quizResultsEmail(data: QuizResultsEmailData) {
  const rows = data.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid ${HAIRLINE};font-family:Helvetica,Arial,sans-serif;">
          <a href="${SITE_URL}/product/${l.productId}" style="font-size:14px;color:#000000;text-decoration:none;">
            ${esc([l.brand, l.name].filter(Boolean).join(" — "))}
          </a>
          <br><span style="font-size:12px;line-height:1.7;color:${MUTED};">${esc(l.reason)}</span>
        </td>
        <td align="right" style="padding:16px 0;border-bottom:1px solid ${HAIRLINE};font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#000000;white-space:nowrap;vertical-align:top;">
          ${aed(l.priceAed)}
        </td>
      </tr>`
    )
    .join("");

  const answersLine = data.answers.length
    ? `<p style="margin:0 0 18px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};">${esc(data.answers.join("  ·  "))}</p>`
    : "";

  return {
    subject: "Your three fragrances",
    html: shell({
      preheader: "The three the fragrance finder chose for you.",
      eyebrow: "Fragrance finder",
      heading: "Your three fragrances",
      intro:
        "Here are the three we chose from your answers. Take your time with them — and if none is quite right, reply to this message and a client advisor will look again by hand.",
      bodyHtml: `${answersLine}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
      ctaLabel: "See them in the boutique",
      ctaHref: `${SITE_URL}/shop`,
    }),
    text: [
      "Here are the three we chose from your answers.",
      ...(data.answers.length ? ["", data.answers.join(" · ")] : []),
      "",
      ...data.lines.map(
        (l) =>
          `  - ${[l.brand, l.name].filter(Boolean).join(" ")}  ${aed(l.priceAed)}\n    ${l.reason}\n    ${SITE_URL}/product/${l.productId}`
      ),
      "",
      "If none is quite right, reply to this message and a client advisor will look again by hand.",
    ].join("\n"),
  };
}

/* ── 6. Owner alerts ─────────────────────────────────────────────────────── */

/**
 * Internal alerts get a deliberately plain shell — no logo, no call to action,
 * no marketing register. They are scanned on a phone to decide whether to act.
 */
function alertShell(opts: { preheader: string; heading: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr><td style="padding:0 0 16px;border-bottom:1px solid ${HAIRLINE};">
          <h1 style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:17px;line-height:1.4;color:#000000;">${esc(opts.heading)}</h1>
        </td></tr>

        <tr><td style="padding:22px 0 0;">${opts.bodyHtml}</td></tr>

        <tr><td style="padding:28px 0 0;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#909090;">
            Automatic notification from ${esc(SITE_URL.replace(/^https?:\/\//, ""))}.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** A label/value line in an alert. `valueHtml` is already-built markup. */
const detailRow = (label: string, valueHtml: string) => `
    <tr>
      <td style="padding:0 14px 10px 0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};white-space:nowrap;vertical-align:top;">${esc(label)}</td>
      <td style="padding:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#000000;">${valueHtml}</td>
    </tr>`;

const mailtoLink = (email: string) =>
  `<a href="mailto:${esc(email)}" style="color:#000000;">${esc(email)}</a>`;

const addressLines = (address?: ShippingAddress | null): string[] =>
  address
    ? [
        address.name,
        address.street,
        [address.city, address.postal_code].filter(Boolean).join(" "),
        address.country,
      ]
        .map((v) => (v ?? "").trim())
        .filter(Boolean)
    : [];

export function newOrderOwnerEmail(data: OwnerOrderEmailData) {
  const name = (data.customerName ?? "").trim();
  const phone = (data.phone ?? "").trim();
  const email = (data.customerEmail ?? "").trim();
  const city = (data.shipping?.city ?? "").trim();
  const address = addressLines(data.shipping);

  // Strip formatting for the dial string, keep the typed one for display.
  const phoneHtml = phone
    ? `<a href="tel:${esc(phone.replace(/[^\d+]/g, ""))}" style="color:#000000;">${esc(phone)}</a>`
    : "Not given";

  const online = paidInFull(data);
  const card = data.payment?.cardLabel ? ` · ${data.payment.cardLabel}` : "";

  return {
    subject: `New order ${data.orderId} — ${aed(data.totalAed)}${online ? " paid" : ""}${city ? ` — ${city}` : ""}`,
    html: alertShell({
      preheader: online
        ? `${aed(data.totalAed)} paid online — nothing to collect${city ? `. Deliver in ${city}` : ""}.`
        : `${aed(data.totalAed)} to collect on delivery${city ? ` in ${city}` : ""}.`,
      heading: `New order ${data.orderId}`,
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${
            data.payment?.method === "credit"
              ? detailRow("Paid", "In full with a gift card and points — nothing to collect")
              : online
                ? detailRow("Paid", `<strong>${esc(aed(data.totalAed))}</strong> online${esc(card)} — nothing to collect`)
                : detailRow("Collect", `<strong>${esc(aed(data.totalAed))}</strong> in cash or by card on delivery`)
          }
          ${detailRow("Customer", esc(name) || "Not given")}
          ${detailRow("Phone", phoneHtml)}
          ${email ? detailRow("Email", mailtoLink(email)) : ""}
          ${detailRow("Deliver to", address.length ? address.map(esc).join("<br>") : "No address supplied")}
          ${data.recipient ? detailRow("Recipient", esc([data.recipient.name, data.recipient.phone].filter(Boolean).join(" · "))) : ""}
          ${data.recipient?.deliveryDate ? detailRow("Deliver on", esc(data.recipient.deliveryDate)) : ""}
          ${data.giftNote?.wrap ? detailRow("Gift", "Gift-wrap this order") : ""}
          ${data.giftNote?.hidePrices ? detailRow("Slip", "Leave prices off the packing slip") : ""}
          ${data.giftNote?.message ? detailRow("Message", esc(data.giftNote.message).replace(/\n/g, "<br>")) : ""}
        </table>
        <div style="margin-top:28px;">${lineItemsTable(data)}</div>`,
    }),
    text: [
      `New order ${data.orderId}`,
      "",
      online
        ? `Paid online: ${aed(data.totalAed)}${card} — nothing to collect`
        : `Collect on delivery: ${aed(data.totalAed)}`,
      `Customer: ${name || "Not given"}`,
      `Phone: ${phone || "Not given"}`,
      ...(email ? [`Email: ${email}`] : []),
      "Deliver to:",
      ...(address.length ? address.map((l) => `  ${l}`) : ["  No address supplied"]),
      ...(data.recipient ? [`Recipient: ${[data.recipient.name, data.recipient.phone].filter(Boolean).join(" · ")}`] : []),
      ...(data.recipient?.deliveryDate ? [`Deliver on: ${data.recipient.deliveryDate}`] : []),
      ...(data.giftNote?.wrap ? ["Gift: gift-wrap this order"] : []),
      ...(data.giftNote?.hidePrices ? ["Slip: leave prices off"] : []),
      ...(data.giftNote?.message ? [`Message: ${data.giftNote.message}`] : []),
      "",
      plainOrder(data),
    ].join("\n"),
  };
}

/** What each payment attention flag means, and what the owner should do. */
const ATTENTION_COPY: Record<string, { title: string; action: string }> = {
  duplicate_payment: {
    title: "Paid twice",
    action: "A second successful payment arrived for this order. Refund the extra payment from the order's payment panel.",
  },
  paid_after_close: {
    title: "Paid after the order was released",
    action: "The payment arrived after the payment window closed, so the stock was released. Refund it, or reinstate the order by hand if the stock is still there.",
  },
  amount_mismatch: {
    title: "Paid a different amount",
    action: "Paymob reported a successful payment for a different amount or currency than the order. The order was NOT marked paid. Check the transaction in the Paymob dashboard and refund it.",
  },
  unknown_integration: {
    title: "Paid through an unconfigured payment method",
    action: "The payment came through a Paymob integration that is not in PAYMOB_INTEGRATION_IDS, so the order was NOT marked paid. Add the integration id if it is yours, or refund it.",
  },
  authorized_not_captured: {
    title: "Authorised but not captured",
    action: "Paymob authorised the card without capturing it, so no money has moved. Capture or void it in the Paymob dashboard; the store uses sale (not auth/capture) integrations.",
  },
};

/** Owner alert for a payment that needs a decision. No card data. */
export function paymentAttentionOwnerEmail(data: OwnerOrderEmailData, alerts: string[]) {
  const known = alerts.filter((a) => ATTENTION_COPY[a]);
  const headline = known.length === 1 ? ATTENTION_COPY[known[0]].title : "Payment needs your attention";
  const items = known.map((a) => ATTENTION_COPY[a]);

  return {
    subject: `Payment attention — order ${data.orderId}: ${headline}`,
    html: alertShell({
      preheader: `Order ${data.orderId}: ${headline}.`,
      heading: `Order ${data.orderId}: ${headline}`,
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${items.map((i) => detailRow(i.title, esc(i.action))).join("")}
          ${detailRow("Order total", esc(aed(data.totalAed)))}
          ${data.customerEmail ? detailRow("Customer", mailtoLink(data.customerEmail.trim())) : ""}
        </table>
        <p style="margin:22px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:${MUTED};">
          Open the order in the admin panel (Orders) to see every payment attempt and to refund.
        </p>`,
    }),
    text: [
      `Order ${data.orderId}: ${headline}`,
      "",
      ...items.map((i) => `${i.title}: ${i.action}`),
      "",
      `Order total: ${aed(data.totalAed)}`,
      ...(data.customerEmail ? [`Customer: ${data.customerEmail.trim()}`] : []),
      "",
      "Open the order in the admin panel (Orders) to see every payment attempt and to refund.",
    ].join("\n"),
  };
}

/** Customer notice that money is on its way back (refund) or was never taken (void). */
export function paymentRefundEmail(data: OrderEmailData, refund: { amountAed: number; voided: boolean }) {
  const subject = refund.voided
    ? `Your payment for Gharib order ${data.orderId} has been cancelled`
    : `A refund for your Gharib order ${data.orderId}`;
  const intro = refund.voided
    ? `${greeting(data.customerName)} the payment of <strong>${aed(data.totalAed)}</strong> for order ${esc(data.orderId)} has been cancelled before it settled. You have not been charged; any temporary hold on your card is released by your bank.`
    : `${greeting(data.customerName)} we have issued a refund of <strong>${aed(refund.amountAed)}</strong> for order ${esc(data.orderId)} to your original payment method. Depending on your bank, it can take several business days to appear on your statement.`;

  return {
    subject,
    html: shell({
      preheader: refund.voided
        ? `You have not been charged for order ${data.orderId}.`
        : `${aed(refund.amountAed)} is on its way back to you.`,
      eyebrow: refund.voided ? "Payment cancelled" : "Refund issued",
      heading: refund.voided ? "Your payment was cancelled" : "Your refund is on its way",
      intro,
      bodyHtml: lineItemsTable(data),
      ctaLabel: "View your order",
      ctaHref: `${SITE_URL}/track?order=${encodeURIComponent(data.orderId)}`,
    }),
    text: [
      greeting(data.customerName).replace(/<[^>]+>/g, ""),
      "",
      refund.voided
        ? `The payment of ${aed(data.totalAed)} for order ${data.orderId} has been cancelled before it settled. You have not been charged.`
        : `We have issued a refund of ${aed(refund.amountAed)} for order ${data.orderId} to your original payment method. Depending on your bank, it can take several business days to appear.`,
      "",
      plainOrder(data),
    ].join("\n"),
  };
}

export function newsletterSignupOwnerEmail(data: NewsletterSignupData) {
  const email = data.email.trim();
  const source = (data.source ?? "").trim();

  return {
    subject: `New newsletter subscriber — ${email}`,
    html: alertShell({
      preheader: `${email} joined the list.`,
      heading: "New newsletter subscriber",
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${detailRow("Email", mailtoLink(email))}
          ${source ? detailRow("Source", esc(source)) : ""}
        </table>`,
    }),
    text: ["New newsletter subscriber", "", `Email: ${email}`, ...(source ? [`Source: ${source}`] : [])].join("\n"),
  };
}

/* ── Reply to a customer enquiry, sent by the admin from the inquiries tab ── */

export type InquiryReplyData = {
  name: string;
  subject: string;
  /** What the customer originally wrote, quoted back so the reply stands alone. */
  originalMessage: string;
  /** The operator's answer, plain text as typed. */
  reply: string;
};

export function inquiryReplyEmail(data: InquiryReplyData) {
  const name = data.name.trim();
  // The enquiry subject is customer-supplied and goes into a mail header, so
  // any newline it carries is collapsed rather than forwarded. Resend takes
  // JSON rather than raw SMTP, but a header value should not depend on that.
  const subject = data.subject.replace(/\s+/g, " ").trim() || "your enquiry";
  const reply = data.reply.trim();
  const original = data.originalMessage.trim();

  // Typed as plain text in a textarea; newlines are the only formatting, and
  // esc() runs first so a customer's own markup cannot ride along in the quote.
  const asHtml = (value: string) => esc(value).replace(/\n/g, "<br>");

  return {
    subject: `Re: ${subject}`,
    html: shell({
      preheader: reply.slice(0, 140),
      eyebrow: "A reply from Gharib",
      heading: "Regarding your enquiry",
      intro: greeting(name),
      bodyHtml: `
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.8;color:#333333;">${asHtml(reply)}</div>
        ${
          original
            ? `<div style="margin-top:30px;border-top:1px solid ${HAIRLINE};padding-top:20px;">
                 <p style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">You wrote</p>
                 <div style="padding:16px 18px;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:${MUTED};">${asHtml(original)}</div>
               </div>`
            : ""
        }`,
    }),
    text: [
      name ? `Dear ${name},` : "Hello,",
      "",
      reply,
      "",
      ...(original ? ["-- You wrote --", "", original, ""] : []),
      "Gharib Perfumes — Dubai, United Arab Emirates",
    ].join("\n"),
  };
}

export function contactInquiryOwnerEmail(data: ContactInquiryData) {
  const name = data.name.trim() || "Not given";
  const email = data.email.trim();
  const subject = data.subject.trim() || "No subject";
  const message = data.message.trim();

  return {
    subject: `New enquiry — ${subject}`,
    html: alertShell({
      preheader: `${name}: ${subject}`,
      heading: "New enquiry",
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${detailRow("From", esc(name))}
          ${email ? detailRow("Email", mailtoLink(email)) : ""}
          ${detailRow("Subject", esc(subject))}
        </table>
        <div style="margin-top:22px;padding:18px 20px;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#000000;">${esc(message).replace(/\n/g, "<br>")}</div>`,
    }),
    text: [
      "New enquiry",
      "",
      `From: ${name}`,
      ...(email ? [`Email: ${email}`] : []),
      `Subject: ${subject}`,
      "",
      message,
    ].join("\n"),
  };
}
