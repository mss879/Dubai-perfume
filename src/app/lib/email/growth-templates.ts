import "server-only";
import { SITE_URL } from "../site";
import { HAIRLINE, MUTED, aed, esc, shell } from "./templates";

/**
 * The growth features' emails (migration 70): gift cards, back in stock,
 * reorder reminders, birthdays and the welcome code. Same shell and register
 * as the order emails. Marketing ones carry an unsubscribe line.
 */

const greeting = (name?: string | null) => (name && name.trim() ? `Dear ${esc(name.trim())},` : "Hello,");
const plainGreeting = (name?: string | null) => (name && name.trim() ? `Dear ${name.trim()},` : "Hello,");
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai" });
const longDate = (iso: string | null | undefined) => (iso ? dateFormat.format(new Date(iso)) : "");

function codeBox(label: string, code: string, under?: string): string {
  return `<div style="margin:6px 0 0;padding:22px;border:1px solid ${HAIRLINE};text-align:center;">
    <p style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">${esc(label)}</p>
    <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:22px;letter-spacing:0.12em;color:#000000;">${esc(code)}</p>
    ${under ? `<p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${MUTED};">${under}</p>` : ""}
  </div>`;
}

function paragraph(html: string): string {
  return `<p style="margin:18px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.8;color:#333333;">${html}</p>`;
}

function unsubscribeFooter(url: string | null, why: string): string {
  if (!url) return "";
  return `<p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#909090;">
    ${esc(why)} <a href="${url}" style="color:#909090;">Unsubscribe</a>.
  </p>`;
}

/* ── Gift card, to the recipient ───────────────────────────────────────── */

export type GiftCardEmailData = {
  kind: "purchased" | "reward" | "issued";
  recipientName?: string | null;
  senderName?: string | null;
  amountAed: number;
  code: string;
  message?: string | null;
  expiresAt?: string | null;
};

export function giftCardEmail(data: GiftCardEmailData) {
  const from = data.senderName?.trim() || "Someone who thinks of you";
  const reward = data.kind === "reward";
  const subject = reward
    ? `A thank-you from Gharib: ${aed(data.amountAed)} to spend`
    : data.kind === "issued"
      ? `A Gharib gift card for you: ${aed(data.amountAed)}`
      : `${from} sent you a Gharib gift card`;
  const how = `Choose anything in the boutique and enter the code in <strong>Gift card or credit</strong> at checkout. It covers your order up to its balance${
    data.expiresAt ? `, and is valid until ${esc(longDate(data.expiresAt))}` : ""
  }.`;
  const messageHtml = data.message?.trim()
    ? `<div style="margin:24px 0 0;padding:18px 22px;background:#f5f5f5;">
         <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;font-style:italic;color:#000000;">&ldquo;${esc(data.message.trim())}&rdquo;</p>
         ${reward ? "" : `<p style="margin:10px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${MUTED};">${esc(from)}</p>`}
       </div>`
    : "";
  return {
    subject,
    html: shell({
      preheader: reward ? `Your referral reward: ${aed(data.amountAed)} to spend at Gharib.` : `A gift card worth ${aed(data.amountAed)}, to spend on anything at Gharib.`,
      eyebrow: reward ? "A thank-you" : "A gift for you",
      heading: aed(data.amountAed),
      intro: reward
        ? `${greeting(data.recipientName)} a friend of yours has received their first order, so this credit is yours, with our thanks.`
        : `${greeting(data.recipientName)} ${esc(from)} has sent you a Gharib gift card.`,
      bodyHtml: messageHtml + codeBox("Your code", data.code) + paragraph(how),
      ctaLabel: "Choose your fragrance",
      ctaHref: `${SITE_URL}/shop`,
    }),
    text: [
      plainGreeting(data.recipientName),
      "",
      reward
        ? `A friend of yours has received their first order, so this credit is yours, with our thanks: ${aed(data.amountAed)}.`
        : `${from} has sent you a Gharib gift card worth ${aed(data.amountAed)}.`,
      ...(data.message?.trim() ? ["", `"${data.message.trim()}"`] : []),
      "",
      `Your code: ${data.code}`,
      "",
      `Enter it in "Gift card or credit" at checkout.${data.expiresAt ? ` Valid until ${longDate(data.expiresAt)}.` : ""}`,
      "",
      `${SITE_URL}/shop`,
    ].join("\n"),
  };
}

/* ── Gift card, the buyer's note ───────────────────────────────────────── */

export function giftCardReceiptEmail(data: {
  buyerName?: string | null;
  recipientName?: string | null;
  recipientEmail: string;
  amountAed: number;
  sendOn?: string | null;
  orderId: string;
}) {
  const who = data.recipientName?.trim() || data.recipientEmail;
  const when = data.sendOn ? `on ${longDate(data.sendOn)}` : "now";
  return {
    subject: data.sendOn ? `Your gift card for ${who} is ready` : `Your gift card is on its way to ${who}`,
    html: shell({
      preheader: `Your ${aed(data.amountAed)} gift card for ${who} will be emailed ${when}.`,
      eyebrow: "Gift card",
      heading: "Thank you",
      intro: `${greeting(data.buyerName)} your payment for a ${esc(aed(data.amountAed))} gift card has arrived. We are emailing it to <strong>${esc(who)}</strong> (${esc(
        data.recipientEmail
      )}) ${esc(when)}, with your message.`,
      bodyHtml: paragraph(`Your order reference is ${esc(data.orderId)}. If the address is wrong, reply to this email and we will put it right.`),
    }),
    text: [
      plainGreeting(data.buyerName),
      "",
      `Your payment for a ${aed(data.amountAed)} gift card has arrived. We are emailing it to ${who} (${data.recipientEmail}) ${when}, with your message.`,
      "",
      `Order reference: ${data.orderId}. If the address is wrong, reply to this email.`,
    ].join("\n"),
  };
}

/* ── Back in stock ──────────────────────────────────────────────────────── */

export function backInStockEmail(data: {
  subject: string;
  body: string;
  brand: string;
  name: string;
  size: string;
  priceAed: number;
  imageUrl?: string | null;
  productUrl: string;
}) {
  const image = data.imageUrl && /^https?:\/\//.test(data.imageUrl) ? data.imageUrl : data.imageUrl ? `${SITE_URL}${data.imageUrl}` : null;
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${HAIRLINE};border-bottom:1px solid ${HAIRLINE};">
      <tr>
        ${image ? `<td width="96" style="padding:16px 16px 16px 0;"><img src="${esc(image)}" width="80" height="80" alt="" style="display:block;object-fit:contain;background:#f5f5f5;"></td>` : ""}
        <td style="padding:16px 0;font-family:Helvetica,Arial,sans-serif;">
          <p style="margin:0;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">${esc(data.brand)}</p>
          <p style="margin:6px 0 0;font-size:15px;color:#000000;">${esc(data.name)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:${MUTED};">${esc(data.size)} · ${esc(aed(data.priceAed))}</p>
        </td>
      </tr>
    </table>`;
  return {
    subject: data.subject,
    html: shell({
      preheader: data.body,
      eyebrow: "Back in stock",
      heading: "It's back",
      intro: esc(data.body),
      bodyHtml: card,
      ctaLabel: "Shop it now",
      ctaHref: data.productUrl,
      footerHtml: `<p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#909090;">You asked us to write when this size was back. This is the only email we send about it.</p>`,
    }),
    text: [data.body, "", `${data.brand} ${data.name} (${data.size}): ${aed(data.priceAed)}`, "", `Shop it now: ${data.productUrl}`].join("\n"),
  };
}

/* ── Reorder reminder ───────────────────────────────────────────────────── */

export function reorderEmail(data: {
  firstName?: string | null;
  subject: string;
  heading: string;
  body: string;
  items: { brand: string; name: string; size: string }[];
  code?: string | null;
  reorderUrl: string;
  unsubscribeUrl: string | null;
}) {
  const rows = data.items
    .map(
      (i) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${HAIRLINE};font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#000000;">
        ${esc([i.brand, i.name].filter(Boolean).join(" — "))}<br><span style="font-size:11px;color:${MUTED};">${esc(i.size)}</span></td></tr>`
    )
    .join("");
  return {
    subject: data.subject,
    html: shell({
      preheader: data.body,
      eyebrow: "Your fragrance",
      heading: data.heading,
      intro: `${greeting(data.firstName)} ${esc(data.body)}`,
      bodyHtml:
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` +
        (data.code ? codeBox("A little something for your next bottle", data.code, "Enter it at checkout.") : ""),
      ctaLabel: "Reorder in one tap",
      ctaHref: data.reorderUrl,
      footerHtml: unsubscribeFooter(data.unsubscribeUrl, "Rather not hear from us about reorders?"),
    }),
    text: [
      plainGreeting(data.firstName),
      "",
      data.body,
      "",
      ...data.items.map((i) => `  - ${[i.brand, i.name].filter(Boolean).join(" ")} (${i.size})`),
      ...(data.code ? ["", `Your code: ${data.code}`] : []),
      "",
      `Reorder in one tap: ${data.reorderUrl}`,
      ...(data.unsubscribeUrl ? ["", `Unsubscribe: ${data.unsubscribeUrl}`] : []),
    ].join("\n"),
  };
}

/* ── Birthday ───────────────────────────────────────────────────────────── */

export function birthdayEmail(data: { firstName?: string | null; points: number; programName: string; worth?: string | null; unsubscribeUrl: string | null }) {
  return {
    subject: `Happy birthday from Gharib`,
    html: shell({
      preheader: `${data.points} ${data.programName} points, with our wishes.`,
      eyebrow: "With our wishes",
      heading: "Happy birthday",
      intro: `${greeting(data.firstName)} we have added <strong>${data.points.toLocaleString("en-AE")} points</strong> to your ${esc(data.programName)} account${
        data.worth ? `, worth ${esc(data.worth)} off a future order` : ""
      }. Spend them whenever you like, at checkout.`,
      bodyHtml: "",
      ctaLabel: "Treat yourself",
      ctaHref: `${SITE_URL}/shop`,
      footerHtml: unsubscribeFooter(data.unsubscribeUrl, "Rather not receive these?"),
    }),
    text: [
      plainGreeting(data.firstName),
      "",
      `We have added ${data.points} points to your ${data.programName} account${data.worth ? `, worth ${data.worth} off a future order` : ""}.`,
      "",
      `${SITE_URL}/shop`,
      ...(data.unsubscribeUrl ? ["", `Unsubscribe: ${data.unsubscribeUrl}`] : []),
    ].join("\n"),
  };
}

/* ── Welcome code ───────────────────────────────────────────────────────── */

export function welcomeCodeEmail(data: { code: string; rewardLine: string; endsAt?: string | null; finePrint?: string | null; unsubscribeUrl: string | null }) {
  const until = data.endsAt ? `Valid until ${longDate(data.endsAt)}.` : "";
  return {
    subject: "Your welcome from Gharib",
    html: shell({
      preheader: `${data.rewardLine} Your code: ${data.code}`,
      eyebrow: "Welcome",
      heading: "A welcome from the maison",
      intro: `Thank you for joining us. ${esc(data.rewardLine)}`,
      bodyHtml: codeBox("Your code", data.code, esc([until, data.finePrint ?? ""].filter(Boolean).join(" "))) + paragraph("Enter it in the code box at checkout, with this email address."),
      ctaLabel: "Discover the collection",
      ctaHref: `${SITE_URL}/shop`,
      footerHtml: unsubscribeFooter(data.unsubscribeUrl, "Rather not receive our emails?"),
    }),
    text: [
      "Thank you for joining us.",
      data.rewardLine,
      "",
      `Your code: ${data.code}`,
      [until, data.finePrint ?? ""].filter(Boolean).join(" "),
      "Enter it in the code box at checkout, with this email address.",
      "",
      `${SITE_URL}/shop`,
      ...(data.unsubscribeUrl ? ["", `Unsubscribe: ${data.unsubscribeUrl}`] : []),
    ].join("\n"),
  };
}
