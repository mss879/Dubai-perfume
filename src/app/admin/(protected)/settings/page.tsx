import type { ReactNode } from "react";
import { requireAdmin } from "../../../lib/auth";
import { getOwnerNotificationAddress, isEmailConfigured } from "../../../lib/email/send";
import { resolveCheckoutMode } from "../../../lib/payments/mode";
import { FREE_SHIPPING_THRESHOLD_AED, SHIPPING_FEE_AED } from "../../../lib/shipping";
import {
  FACEBOOK_URL,
  INSTAGRAM_URL,
  SITE_EMAIL,
  SITE_NAME,
  SITE_PHONE_DISPLAY,
  SITE_URL,
  TIKTOK_URL,
  TRADE_LICENCE,
  WHATSAPP_NUMBER,
} from "../../../lib/site";
import { createSessionSupabase } from "../../../lib/supabase-server";
import { aed } from "../../_lib/format";
import { loadLockState } from "../../_lib/queries";
import { Badge } from "../../_ui/Badge";
import { Card, CardBody, CardHeader } from "../../_ui/Card";
import { PageHeader } from "../../_ui/PageHeader";
import PaymentsPanel from "../payments/PaymentsPanel";
import SiteLockSettings from "./SiteLockSettings";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const CHECKOUT_LABEL = {
  cod: { text: "Customers pay cash on delivery.", tone: "neutral" as const },
  online: { text: "Customers pay online: card, Apple Pay or Google Pay.", tone: "emerald" as const },
  unavailable: {
    text: "Checkout is closed: online payment is switched on but Paymob is not fully set up on this deployment.",
    tone: "red" as const,
  },
};

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-6">
      <dt className="w-48 shrink-0 text-[14px] text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-[14px] text-neutral-900">{children}</dd>
    </div>
  );
}

function NotSet() {
  return <span className="text-neutral-400">Not set</span>;
}

export default async function SettingsPage() {
  await requireAdmin("/admin/settings");
  const supabase = await createSessionSupabase();
  const [lock, checkout, admins] = await Promise.all([
    loadLockState(),
    resolveCheckoutMode(),
    supabase.from("customers").select("email, first_name, last_name").eq("is_admin", true).order("email"),
  ]);
  const checkoutLabel = CHECKOUT_LABEL[checkout];

  return (
    <>
      <PageHeader title="Settings" description="How customers pay, whether the shop is open, and how the store is set up." />

      <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-2 text-[14px]">
        {[
          ["#payments", "Payments"],
          ["#store-status", "Store status"],
          ["#delivery", "Delivery"],
          ["#store-details", "Store details"],
          ["#email", "Email"],
          ["#admins", "Admin access"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-neutral-700 hover:border-neutral-400 hover:text-neutral-900"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-6">
        <Card id="payments" aria-labelledby="payments-title" className="scroll-mt-20">
          <CardHeader
            id="payments-title"
            title="Payments"
            description="Online payment through Paymob, and the switch between online payment and cash on delivery."
            actions={<Badge tone={checkoutLabel.tone}>{checkout === "online" ? "Online" : checkout === "cod" ? "Cash on delivery" : "Closed"}</Badge>}
          />
          <CardBody>
            <p className="mb-4 text-[14px] text-neutral-700">{checkoutLabel.text}</p>
            <PaymentsPanel />
          </CardBody>
        </Card>

        <Card id="store-status" aria-labelledby="store-status-title" className="scroll-mt-20">
          <CardHeader
            id="store-status-title"
            title="Store status"
            description="Lock the shop behind a “Launching soon” page, with a PIN for previewing."
          />
          <CardBody>
            <SiteLockSettings initial={lock} />
          </CardBody>
        </Card>

        <Card id="delivery" aria-labelledby="delivery-title" className="scroll-mt-20">
          <CardHeader id="delivery-title" title="Delivery" />
          <CardBody>
            <dl className="divide-y divide-neutral-100">
              <InfoRow label="Free delivery">On orders of {aed(FREE_SHIPPING_THRESHOLD_AED)} or more</InfoRow>
              <InfoRow label="Delivery fee">{aed(SHIPPING_FEE_AED)} below that</InfoRow>
            </dl>
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
              These are set in the code and in the database&rsquo;s order function together, so the price shown at
              checkout always matches what is charged. Changing them is a small developer task.
            </p>
          </CardBody>
        </Card>

        <Card id="store-details" aria-labelledby="store-details-title" className="scroll-mt-20">
          <CardHeader id="store-details-title" title="Store details" description="Shown in the footer, emails and legal pages." />
          <CardBody>
            <dl className="divide-y divide-neutral-100">
              <InfoRow label="Store name">{SITE_NAME}</InfoRow>
              <InfoRow label="Website">{SITE_URL}</InfoRow>
              <InfoRow label="Contact email">{SITE_EMAIL}</InfoRow>
              <InfoRow label="Phone">{SITE_PHONE_DISPLAY}</InfoRow>
              <InfoRow label="WhatsApp">{WHATSAPP_NUMBER || <NotSet />}</InfoRow>
              <InfoRow label="Trade licence">{TRADE_LICENCE || <NotSet />}</InfoRow>
              <InfoRow label="Instagram">{INSTAGRAM_URL || <NotSet />}</InfoRow>
              <InfoRow label="TikTok">{TIKTOK_URL || <NotSet />}</InfoRow>
              <InfoRow label="Facebook">{FACEBOOK_URL || <NotSet />}</InfoRow>
            </dl>
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
              Name, email and phone are set in the code; WhatsApp, licence and social links in the hosting
              settings. Ask your developer to change them.
            </p>
          </CardBody>
        </Card>

        <Card id="email" aria-labelledby="email-title" className="scroll-mt-20">
          <CardHeader id="email-title" title="Email" description="Order confirmations to customers and alerts to you." />
          <CardBody>
            <dl className="divide-y divide-neutral-100">
              <InfoRow label="Sending emails">
                {isEmailConfigured ? <Badge tone="emerald">On</Badge> : <Badge tone="amber">Off: not set up</Badge>}
              </InfoRow>
              <InfoRow label="Your order alerts go to">{getOwnerNotificationAddress() || <NotSet />}</InfoRow>
            </dl>
          </CardBody>
        </Card>

        <Card id="admins" aria-labelledby="admins-title" className="scroll-mt-20">
          <CardHeader id="admins-title" title="Admin access" description="People who can sign in to this admin." />
          <CardBody>
            {admins.error ? (
              <p className="text-[14px] text-neutral-500">The admin list couldn&rsquo;t be read.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {(admins.data ?? []).map((admin) => {
                  const name = [admin.first_name, admin.last_name].filter(Boolean).join(" ");
                  return (
                    <li key={admin.email} className="flex flex-col py-3 sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-[14px] font-medium text-neutral-900">{name || admin.email}</span>
                      {name ? <span className="text-[14px] text-neutral-500">{admin.email}</span> : null}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
              To give someone access, they first create an account on the shop; then a developer marks the account
              as an admin in the database. There are no separate roles yet: every admin can do everything.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
