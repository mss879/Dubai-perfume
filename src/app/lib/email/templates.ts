import "server-only";
import { SITE_URL, SITE_EMAIL } from "../site";

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

export type OrderEmailData = {
  orderId: string;
  customerName?: string | null;
  lines: OrderLine[];
  subtotalAed: number;
  shippingFeeAed: number;
  discountAed: number;
  totalAed: number;
  trackingNumber?: string | null;
};

const HAIRLINE = "#dcdcdc";
const MUTED = "#646464";

const aed = (n: number) =>
  `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(opts: {
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
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
          ${aed(l.unitPriceAed * l.quantity)}
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
      ${data.discountAed > 0 ? totalRow("Discount", `− ${aed(data.discountAed)}`) : ""}
      ${totalRow("Delivery", data.shippingFeeAed > 0 ? aed(data.shippingFeeAed) : "Complimentary")}
      ${totalRow("Total due on delivery", aed(data.totalAed), true)}
    </table>`;
}

function plainOrder(data: OrderEmailData): string {
  const items = data.lines
    .map((l) => `  - ${[l.brand, l.name].filter(Boolean).join(" ")}${l.size ? ` (${l.size})` : ""} x${l.quantity}  ${aed(l.unitPriceAed * l.quantity)}`)
    .join("\n");
  return [
    `Order ${data.orderId}`,
    "",
    items,
    "",
    `Subtotal: ${aed(data.subtotalAed)}`,
    ...(data.discountAed > 0 ? [`Discount: -${aed(data.discountAed)}`] : []),
    `Delivery: ${data.shippingFeeAed > 0 ? aed(data.shippingFeeAed) : "Complimentary"}`,
    `Total due on delivery: ${aed(data.totalAed)}`,
  ].join("\n");
}

const greeting = (name?: string | null) =>
  name && name.trim() ? `Dear ${esc(name.trim())},` : "Hello,";

/* ── 1. Order placed ─────────────────────────────────────────────────────── */

export function orderConfirmationEmail(data: OrderEmailData) {
  const trackUrl = `${SITE_URL}/track?order=${encodeURIComponent(data.orderId)}`;
  return {
    subject: `Your Gharib order ${data.orderId} is confirmed`,
    html: shell({
      preheader: `We have received order ${data.orderId}. Payment is collected on delivery.`,
      eyebrow: "Order confirmed",
      heading: "Thank you for your order",
      intro: `${greeting(data.customerName)} we have received your order and it is now being prepared. <strong>Payment is collected in cash or by card when your parcel arrives</strong> — nothing is charged before then.`,
      bodyHtml: lineItemsTable(data),
      ctaLabel: "Track your order",
      ctaHref: trackUrl,
    }),
    text: [
      greeting(data.customerName).replace(/<[^>]+>/g, ""),
      "",
      "We have received your order and it is now being prepared.",
      "Payment is collected in cash or by card when your parcel arrives.",
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
  const trackingBlock = data.trackingNumber
    ? `<div style="margin-top:24px;padding:18px 20px;background:#f5f5f5;">
         <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">Tracking number</p>
         <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;letter-spacing:0.08em;color:#000000;">${esc(data.trackingNumber)}</p>
       </div>`
    : "";

  return {
    subject: `Your Gharib order ${data.orderId} is out for delivery`,
    html: shell({
      preheader: `Order ${data.orderId} is with our courier today.`,
      eyebrow: "On its way",
      heading: "Your order is out for delivery",
      intro: `${greeting(data.customerName)} your parcel is with our courier and arrives today. Please have <strong>${aed(data.totalAed)}</strong> ready in cash, or a card for the courier's terminal.`,
      bodyHtml: trackingBlock + `<div style="margin-top:24px;">${lineItemsTable(data)}</div>`,
      ctaLabel: "Track your order",
      ctaHref: trackUrl,
    }),
    text: [
      greeting(data.customerName).replace(/<[^>]+>/g, ""),
      "",
      "Your parcel is with our courier and arrives today.",
      `Please have ${aed(data.totalAed)} ready in cash, or a card for the courier's terminal.`,
      ...(data.trackingNumber ? ["", `Tracking number: ${data.trackingNumber}`] : []),
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
