import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import Footer from "../../components/Footer";
import Price from "../../components/Price";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { isMissingFunction, MIGRATIONS_PENDING_MESSAGE } from "../../lib/rpc-errors";
import { ORDER_STEPS, isCancelledOrder, stepIndexForStatus } from "../../lib/orders";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const HAIRLINE = "rgba(0,0,0,0.12)";

type TrackingEntry = {
  status: string;
  location: string | null;
  description: string | null;
  updated_at: string | null;
};

type TrackedOrder = {
  order_id: string;
  status: string;
  total_price: number | string;
  created_at: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking: TrackingEntry[];
};

/**
 * "no-match" covers a wrong email, a missing email and an unknown order alike —
 * an order number on its own must never confirm that an order exists.
 */
type Lookup =
  | { kind: "order"; order: TrackedOrder }
  | { kind: "no-match" }
  | { kind: "unavailable"; message: string };

const formatDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

async function lookupOrder(orderId: string, email: string): Promise<Lookup> {
  if (!orderId || !email) return { kind: "no-match" };
  if (!isSupabaseConfigured) {
    return { kind: "unavailable", message: "Order details are unavailable right now." };
  }

  const supabase = createServerSupabase();
  // Same gate as /api/track: the RPC matches on order id AND email, and the
  // orders table itself stays closed to anon reads after migration 39.
  const { data, error } = await supabase.rpc("track_guest_order", {
    p_order_id: orderId,
    p_email: email,
  });

  if (error) {
    if (isMissingFunction(error)) {
      console.error("track_guest_order is missing — apply migrations 38–42.");
      return { kind: "unavailable", message: MIGRATIONS_PENDING_MESSAGE };
    }
    console.error("Order confirmation lookup failed:", error.message);
    return { kind: "unavailable", message: "Order details are unavailable right now." };
  }
  if (!data || typeof data !== "object") return { kind: "no-match" };

  const order = data as TrackedOrder;
  return { kind: "order", order: { ...order, tracking: order.tracking ?? [] } };
}

function OrderShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="maison min-h-screen flex flex-col relative overflow-x-hidden">
      <AppHeader />
      <main className="flex-grow">
        <section className="maison-container pt-14 md:pt-20 pb-10 md:pb-14 text-center">
          <p className="maison-eyebrow">Order</p>
          <h1 className="maison-page-title mt-5">Your order</h1>
        </section>
        <div className="maison-container pb-16 md:pb-24">
          <div className="mx-auto max-w-[560px]">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  // Next 16: params and searchParams are both promises. The confirmation screen
  // links here as /order/{id}?email={email}; the email is what unlocks the order.
  const [{ id }, { email }] = await Promise.all([params, searchParams]);
  const result = await lookupOrder(id.trim(), (email ?? "").trim());

  if (result.kind !== "order") {
    return (
      <OrderShell>
        <div className="text-center">
          <p className="maison-body">
            {result.kind === "unavailable"
              ? result.message
              : "To open an order we need both the order number and the email address it was placed with. Please follow the link from your confirmation, or look the order up below."}
          </p>
          <div className="mt-10">
            <Link href="/track" className="maison-btn-outline">
              Track your order
            </Link>
          </div>
        </div>
      </OrderShell>
    );
  }

  const { order } = result;
  const activeStep = stepIndexForStatus(order.status);
  const cancelled = isCancelledOrder(order.status);

  return (
    <OrderShell>
      <section className="border-t pt-10" style={{ borderColor: HAIRLINE }}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-[16px] uppercase tracking-[0.08em] text-black">
            {order.order_id}
          </h2>
          <span className="text-[13px] font-light text-[#646464]">
            Placed {formatDate(order.created_at)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
          <span className="maison-body">Status</span>
          <span className="text-[14px] font-normal text-black">
            {cancelled ? "Cancelled" : ORDER_STEPS[activeStep].label}
          </span>
        </div>

        <div
          className="mt-6 pt-5 flex flex-wrap items-baseline justify-between gap-4"
          style={{ borderTop: `1px solid ${HAIRLINE}` }}
        >
          <span className="font-display text-[16px] uppercase tracking-[0.08em] text-black">
            Total due on delivery
          </span>
          <Price
            amountAed={parseFloat(String(order.total_price)) || 0}
            className="font-display text-[16px] uppercase tracking-[0.08em] text-black"
          />
        </div>
        <p className="mt-4 text-[13px] font-light leading-[1.8] text-[#646464]">
          Nothing has been charged. This order is paid in cash to the courier when your parcel
          arrives — please have the amount ready.
        </p>

        {cancelled ? (
          <p className="mt-10 text-[14px] font-light leading-relaxed text-black">
            This order was cancelled. Please contact us if you believe this is a mistake.
          </p>
        ) : (
          <ol className="mt-10 flex flex-col gap-0">
            {ORDER_STEPS.map((step, index) => {
              const reached = index <= activeStep;
              return (
                <li key={step.key} className="flex items-start gap-4">
                  <div className="flex flex-col items-center self-stretch">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border ${
                        reached ? "bg-black border-black" : "bg-transparent"
                      }`}
                      style={reached ? undefined : { borderColor: HAIRLINE }}
                    />
                    {index < ORDER_STEPS.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="w-px flex-1 my-1"
                        style={{
                          backgroundColor: index < activeStep ? "#000" : HAIRLINE,
                          minHeight: "34px",
                        }}
                      />
                    )}
                  </div>
                  <span
                    className={`pb-6 text-[14px] ${
                      reached ? "font-normal text-black" : "font-light text-[#909090]"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {order.tracking_number && (
          <p className="mt-2 text-[13px] font-light text-[#646464]">
            Carrier reference {order.tracking_number}
            {order.tracking_url && (
              <>
                {" — "}
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="maison-link"
                >
                  view with the carrier
                </a>
              </>
            )}
          </p>
        )}

        {order.tracking.length > 0 && (
          <div className="mt-10 border-t pt-8" style={{ borderColor: HAIRLINE }}>
            <h3 className="maison-eyebrow">History</h3>
            <ul className="mt-6 flex flex-col gap-6">
              {order.tracking.map((entry, index) => (
                <li key={`${entry.status}-${index}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="text-[14px] font-normal text-black">{entry.status}</span>
                    <span className="text-[12px] font-light text-[#909090]">
                      {formatDate(entry.updated_at)}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="mt-1.5 text-[13px] font-light leading-relaxed text-[#646464]">
                      {entry.description}
                    </p>
                  )}
                  {entry.location && (
                    <p className="mt-1 text-[12px] font-light text-[#909090]">{entry.location}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-10 text-[13px] font-light text-[#646464]">
          Follow the parcel any time on our{" "}
          <Link href={`/track?order=${encodeURIComponent(order.order_id)}`} className="maison-link">
            tracking page
          </Link>
          , or{" "}
          <Link href="/customer/dashboard" className="maison-link">
            see all your orders
          </Link>
          .
        </p>
      </section>
    </OrderShell>
  );
}
