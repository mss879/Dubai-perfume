import { notFound } from "next/navigation";
import { ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth";
import { createSessionSupabase } from "../../../../lib/supabase-server";
import { orderStatusBadge, paymentBadge } from "../../../_lib/badges";
import { aed, ago, dubaiDateTime, serverNow } from "../../../_lib/format";
import { loadOrderDetail } from "../../../_lib/order-data";
import { nextStepFor, paymentReturned } from "../../../_lib/order-queues";
import { isOnlinePaid } from "../../../../lib/payments/status";
import { Badge } from "../../../_ui/Badge";
import { Card, CardBody, CardHeader } from "../../../_ui/Card";
import { PageHeader } from "../../../_ui/PageHeader";
import OrderPaymentSection from "../../payments/OrderPaymentSection";
import OrderMoreActions from "../_components/OrderMoreActions";
import OrderNextStep from "../_components/OrderNextStep";
import PrintButton from "../_components/PrintButton";
import TrackingEditor from "../_components/TrackingEditor";

export const dynamic = "force-dynamic";

const ORDER_ID = /^[A-Za-z0-9_-]{1,100}$/;

function orderIdFrom(raw: string): string | null {
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return null;
  }
  id = id.trim();
  return ORDER_ID.test(id) ? id : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = orderIdFrom(id);
  return { title: orderId ? `Order ${orderId}` : "Order" };
}

const NEXT_STEP_HELP: Record<string, string> = {
  accept: "Check the order, then accept it. Nothing is sent to the customer at this step.",
  pack: "Pack the order. Marking it packed moves it to “To dispatch”.",
  dispatch: "Hand it to the courier, then dispatch it with the tracking number. The customer is emailed.",
  deliver: "When the courier confirms delivery, mark it delivered. The customer is emailed.",
};

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className={strong ? "text-[15px] font-semibold text-neutral-900" : "text-[14px] text-neutral-600"}>{label}</dt>
      <dd className={strong ? "text-[15px] font-semibold tabular-nums text-neutral-900" : "text-[14px] tabular-nums text-neutral-900"}>
        {value}
      </dd>
    </div>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = orderIdFrom(id);
  if (!orderId) notFound();
  await requireAdmin(`/admin/orders/${encodeURIComponent(orderId)}`);

  const supabase = await createSessionSupabase();
  const [order, paymentRow] = await Promise.all([
    loadOrderDetail(supabase, orderId),
    // Named columns only: the payment row also holds the shopper's token hash.
    supabase.from("order_payments").select("state, due_at").eq("order_id", orderId).maybeSingle(),
  ]);
  if (!order) notFound();

  const now = serverNow();
  const online = order.paymentMethod === "paymob";
  // Migration 70: paid in full by a gift card and points: nothing to collect.
  const credit = order.paymentMethod === "credit";
  const cod = !online && !credit;
  const growth = order.growth;
  const credits = (growth?.pointsValue ?? 0) + (growth?.giftCardAmount ?? 0);
  const status = orderStatusBadge(order.status);
  const payment = paymentBadge(order.paymentMethod, order.paymentStatus);
  const paymentState = (paymentRow.data as { state?: string } | null)?.state ?? null;
  const dueAt = (paymentRow.data as { due_at?: string } | null)?.due_at ?? null;
  const step = nextStepFor({ status: order.status, payment_method: order.paymentMethod, payment_status: order.paymentStatus, gift_card: order.giftCard });
  const collect = order.total + (cod ? order.packingCharges : 0);
  const returned = paymentReturned({ payment_method: order.paymentMethod, payment_status: order.paymentStatus });
  const digits = (order.phone ?? "").replace(/\D/g, "");
  const addressLine = [order.address.street, order.address.city, order.address.country].filter(Boolean).join(", ");
  const mapsHref = addressLine ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}` : null;
  const statusKey = order.status.toLowerCase();
  const showTracking = ["fulfilled", "out_for_delivery", "shipped", "delivered"].includes(statusKey);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          back={{ href: "/admin/orders", label: "Orders" }}
          title={`Order ${order.id}`}
          badges={
            <>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
              <Badge tone={payment.tone}>{payment.label}</Badge>
            </>
          }
          description={`Placed ${dubaiDateTime(order.createdAt)} · ${ago(order.createdAt, now)}`}
          actions={
            <>
              <PrintButton />
              <OrderMoreActions
                order={{
                  id: order.id,
                  status: order.status,
                  paymentMethod: order.paymentMethod,
                  paymentStatus: order.paymentStatus,
                  paymentState,
                }}
              />
            </>
          }
        />

        {growth?.kind === "gift_card" ? (
          <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-[14px] text-sky-900">
            <strong className="font-semibold">A digital gift card: nothing to pack or send.</strong> The store emails it to the
            recipient by itself once the payment arrives.
            <ul className="mt-2 list-disc pl-5">
              {growth.cards.map((c) => (
                <li key={c.code}>
                  {aed(c.amount)} for {c.recipientName ? `${c.recipientName}, ` : ""}
                  {c.recipientEmail} ·{" "}
                  {c.status === "pending"
                    ? "waiting for payment"
                    : c.status === "void"
                      ? "cancelled"
                      : c.sentAt
                        ? `emailed ${dubaiDateTime(c.sentAt)}`
                        : c.sendOn
                          ? `to be emailed on ${c.sendOn}`
                          : "to be emailed within 15 minutes"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {order.giftWrap || growth?.giftMessage || growth?.hidePrices ? (
          <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 px-5 py-4 text-[14px] text-violet-900">
            <strong className="font-semibold">This order is a gift.</strong>{" "}
            {order.giftWrap
              ? order.offers.some((o) => o.giftWrap)
                ? `Gift-wrap it: it was bought as ${order.offers.filter((o) => o.giftWrap).map((o) => `“${o.title}”`).join(", ")}, which arrives gift-wrapped.`
                : "Gift-wrap it."
              : null}{" "}
            {growth?.hidePrices ? "Leave the prices off anything in the parcel." : null}
            {growth?.giftMessage ? (
              <span className="mt-2 block whitespace-pre-line rounded-lg bg-white/70 px-3 py-2 italic text-violet-950">“{growth.giftMessage}”</span>
            ) : null}
          </div>
        ) : null}
        {growth?.sendToOther ? (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-[14px] text-blue-900">
            <strong className="font-semibold">Sent to someone else:</strong> {growth.recipientName}
            {growth.recipientPhone ? ` · ${growth.recipientPhone}` : ""}. The address below is theirs; the buyer is {order.email}.
            {growth.deliveryDate ? (
              <>
                {" "}
                <strong className="font-semibold">Preferred delivery date: {growth.deliveryDate}.</strong>
              </>
            ) : null}
            {cod ? " With cash on delivery, the courier collects from them: call the buyer first if that needs arranging." : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            {step ? (
              <Card className="border-neutral-900/15">
                <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-neutral-500">Next step</p>
                    <p className="mt-0.5 text-[15px] text-neutral-800">{NEXT_STEP_HELP[step.action]}</p>
                  </div>
                  <div className="sm:w-56 sm:shrink-0">
                    <OrderNextStep
                      order={{
                        id: order.id,
                        status: order.status,
                        paymentMethod: order.paymentMethod,
                        paymentStatus: order.paymentStatus,
                        total: order.total,
                        packingCharges: order.packingCharges,
                        name: order.name,
                        trackingNumber: order.trackingNumber,
                        giftCard: order.giftCard,
                      }}
                      fullWidth
                    />
                  </div>
                </CardBody>
              </Card>
            ) : returned && order.status !== "cancelled" ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-900">
                <strong className="font-semibold">
                  {order.paymentStatus === "voided" ? "The payment was voided." : "The payment was refunded in full."}
                </strong>{" "}
                This order is no longer paid for, so don&rsquo;t send it. Cancel it with &ldquo;Cancel order&rdquo; at the top of the page.
              </div>
            ) : online && paymentState === "awaiting" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-900">
                <strong className="font-semibold">Waiting for the customer to pay online.</strong> Nothing to do yet:
                once Paymob confirms the payment, this order moves to &ldquo;To accept&rdquo;.
                {dueAt ? ` If it isn't paid by ${dubaiDateTime(dueAt)}, it cancels itself and its stock comes back.` : ""}
              </div>
            ) : null}

            <Card>
              <CardHeader title="Items" description={`${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}`} />
              <ul className="divide-y divide-neutral-100">
                {order.items.map((item, index) => (
                  <li key={`${item.name}-${item.size}-${index}`} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail from our own bucket
                      <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 object-contain" />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-lg border border-neutral-200 bg-neutral-50" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-neutral-900">
                        {item.name}
                        {item.gift ? (
                          <Badge tone="violet" className="ml-2 align-middle">
                            Free gift
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-[13px] text-neutral-500">
                        {[item.brand, item.size].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] tabular-nums text-neutral-900">
                        {item.gift ? `${item.quantity} × gift` : `${item.quantity} × ${aed(item.unitPrice)}`}
                      </p>
                      <p className="text-[13px] tabular-nums text-neutral-500">{item.gift ? "AED 0.00" : aed(item.unitPrice * item.quantity)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <CardBody className="border-t border-neutral-100">
                <dl>
                  <Row label="Subtotal" value={aed(order.subtotal)} />
                  {order.offers
                    .filter((o) => o.kind !== "gift" && o.saving > 0)
                    .map((o, i) => (
                      <Row key={`${o.title}-${i}`} label={`Offer: ${o.title}`} value={`− ${aed(o.saving)}`} />
                    ))}
                  {order.discountAmount - order.offerSaving - credits > 0.004 ? (
                    <Row
                      label={order.discountCode ? `Discount (${order.discountCode})` : "Discount"}
                      value={`− ${aed(order.discountAmount - order.offerSaving - credits)}`}
                    />
                  ) : null}
                  {(growth?.giftWrapFee ?? 0) > 0 ? <Row label="Gift wrap" value={aed(growth?.giftWrapFee ?? 0)} /> : null}
                  {(growth?.pointsValue ?? 0) > 0 ? (
                    <Row label={`Points (${(growth?.pointsRedeemed ?? 0).toLocaleString("en-AE")})`} value={`− ${aed(growth?.pointsValue ?? 0)}`} />
                  ) : null}
                  {(growth?.giftCardAmount ?? 0) > 0 ? (
                    <Row label={`Gift card ${growth?.giftCardCode ?? ""}`.trim()} value={`− ${aed(growth?.giftCardAmount ?? 0)}`} />
                  ) : null}
                  <Row
                    label="Delivery"
                    value={
                      order.shippingFee > 0 && order.offers.some((o) => o.freeDelivery)
                        ? `${aed(order.shippingFee)}, free with the offer`
                        : order.shippingFee > 0
                          ? aed(order.shippingFee)
                          : "Free"
                    }
                  />
                  <Row
                    label={online && isOnlinePaid(order.paymentMethod, order.paymentStatus) ? "Total paid online" : credit ? "Left to pay (paid in full)" : "Order total"}
                    value={aed(order.total)}
                    strong
                  />
                  {cod && order.packingCharges > 0 ? <Row label="Packing charge" value={aed(order.packingCharges)} /> : null}
                  {cod ? <Row label="Courier collects in cash" value={aed(collect)} strong /> : null}
                </dl>
                {(growth?.pointsEarned ?? 0) > 0 || growth?.referral ? (
                  <p className="mt-2 text-[13px] text-neutral-500">
                    {(growth?.pointsEarned ?? 0) > 0
                      ? `Earns ${(growth?.pointsEarned ?? 0).toLocaleString("en-AE")} points when it's marked delivered. `
                      : ""}
                    {growth?.referral
                      ? `A first order through ${growth.referral.code}'s referral (${growth.referral.status === "rewarded" ? "reward issued" : growth.referral.status === "pending" ? "reward issued once delivered" : growth.referral.status}).`
                      : ""}
                  </p>
                ) : null}
                {order.currency !== "AED" && order.convertedTotal ? (
                  <p className="mt-2 text-[13px] text-neutral-500">
                    The customer was shown {order.convertedTotal}; the order is charged in AED.
                  </p>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Payment" />
              <CardBody>
                {online ? (
                  <OrderPaymentSection orderId={order.id} paymentStatus={order.paymentStatus} />
                ) : credit ? (
                  <p className="text-[14px] text-neutral-700">
                    Paid in full with a gift card and points. <strong className="font-semibold">Nothing to collect.</strong>
                  </p>
                ) : (
                  <p className="text-[14px] text-neutral-700">
                    Cash on delivery: the courier collects <strong className="font-semibold">{aed(collect)}</strong> when
                    the parcel arrives.
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="History" />
              <CardBody>
                {order.timeline.length === 0 ? (
                  <p className="text-[14px] text-neutral-500">No history recorded yet.</p>
                ) : (
                  <ol className="relative flex flex-col gap-4 border-l border-neutral-200 pl-5">
                    {order.timeline.map((entry) => (
                      <li key={entry.id} className="relative">
                        <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-neutral-300 ring-4 ring-white" aria-hidden />
                        <p className="text-[14px] font-medium text-neutral-900">{entry.status}</p>
                        {entry.description ? <p className="text-[14px] text-neutral-600">{entry.description}</p> : null}
                        <p className="text-[13px] text-neutral-400">{dubaiDateTime(entry.at)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Customer" />
              <CardBody className="flex flex-col gap-3">
                <p className="text-[15px] font-semibold text-neutral-900">{order.address.name || order.name}</p>
                <div className="flex flex-col gap-2 text-[14px]">
                  {order.email ? (
                    <a href={`mailto:${order.email}`} className="inline-flex items-center gap-2 break-all text-neutral-700 hover:text-neutral-900">
                      <Mail className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                      {order.email}
                    </a>
                  ) : null}
                  {order.phone ? (
                    <a href={`tel:${order.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-900">
                      <Phone className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                      {order.phone}
                    </a>
                  ) : null}
                  {digits.length >= 8 ? (
                    <a
                      href={`https://wa.me/${digits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-900"
                    >
                      <MessageCircle className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                      WhatsApp
                    </a>
                  ) : null}
                </div>
                <div className="border-t border-neutral-100 pt-3">
                  <p className="text-[13px] font-medium text-neutral-500">Delivery address</p>
                  <address className="mt-1 text-[14px] not-italic leading-relaxed text-neutral-800">
                    {order.address.street ? <span className="block">{order.address.street}</span> : null}
                    {[order.address.city, order.address.postalCode].filter(Boolean).length ? (
                      <span className="block">{[order.address.city, order.address.postalCode].filter(Boolean).join(" ")}</span>
                    ) : null}
                    {order.address.country ? <span className="block">{order.address.country}</span> : null}
                  </address>
                  {mapsHref ? (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-medium text-neutral-900 underline underline-offset-2"
                    >
                      <MapPin className="h-4 w-4" aria-hidden />
                      Open in Maps
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Delivery" />
              <CardBody>
                {showTracking ? (
                  <TrackingEditor
                    orderId={order.id}
                    status={statusKey}
                    trackingNumber={order.trackingNumber}
                    trackingUrl={order.trackingUrl}
                  />
                ) : (
                  <p className="text-[14px] text-neutral-500">Tracking details are added when you dispatch the order.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      {/* The packing slip: only this prints. */}
      <section className="hidden text-black print:block">
        <p className="text-[20px] font-semibold" style={{ fontFamily: "var(--font-playfair), serif" }}>
          Gharib
        </p>
        <p className="mt-1 text-[14px]">Packing slip · Order {order.id} · {dubaiDateTime(order.createdAt)}</p>
        <div className="mt-6 text-[14px] leading-relaxed">
          <p className="font-semibold">Deliver to</p>
          <p>{order.address.name || order.name}</p>
          {order.address.street ? <p>{order.address.street}</p> : null}
          <p>{[order.address.city, order.address.postalCode, order.address.country].filter(Boolean).join(", ")}</p>
          {order.phone ? <p>{order.phone}</p> : null}
        </div>
        <table className="mt-6 w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-black">
              <th className="py-2 pr-4 text-left">Qty</th>
              <th className="py-2 pr-4 text-left">Item</th>
              <th className="py-2 text-left">Size</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={`print-${index}`} className="border-b border-neutral-300">
                <td className="py-2 pr-4 align-top">{item.quantity}</td>
                <td className="py-2 pr-4 align-top">
                  {item.name}
                  {item.brand ? ` (${item.brand})` : ""}
                  {item.gift ? " — free gift" : ""}
                </td>
                <td className="py-2 align-top">{item.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {order.giftWrap ? <p className="mt-6 text-[16px] font-semibold">GIFT-WRAP THIS ORDER</p> : null}
        {growth?.sendToOther ? (
          <p className="mt-2 text-[14px]">
            For {growth.recipientName}
            {growth.recipientPhone ? ` · ${growth.recipientPhone}` : ""}
            {growth.deliveryDate ? ` · deliver on ${growth.deliveryDate}` : ""}
          </p>
        ) : null}
        {growth?.giftMessage ? (
          <div className="mt-4 border border-black p-4 text-[15px] italic leading-relaxed whitespace-pre-line">Gift message: “{growth.giftMessage}”</div>
        ) : null}
        {growth?.hidePrices ? (
          <p className="mt-6 text-[14px]">A gift: no prices in the parcel.{cod ? ` The courier collects ${aed(collect)} (keep this line out of the parcel).` : ""}</p>
        ) : credit ? (
          <p className="mt-6 text-[14px]">Paid in full: nothing to collect.</p>
        ) : cod ? (
          <p className="mt-6 text-[16px] font-semibold">Cash on delivery: collect {aed(collect)}</p>
        ) : returned ? (
          <p className="mt-6 text-[16px] font-semibold">Payment returned: do not send.</p>
        ) : (
          <p className="mt-6 text-[14px]">Paid online: nothing to collect.</p>
        )}
      </section>
    </>
  );
}
