"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrency } from "../lib/currency";
import { getBrowserSupabase } from "../lib/supabase-browser";
import { isPaymobCheckoutUrl, savePendingPayment } from "../lib/payments/pending-payment";
import { useMinuteClock } from "../components/features/useMinuteClock";

const HAIRLINE = "rgba(0,0,0,0.12)";
const dubaiDay = (ms: number) => new Date(ms + 4 * 3600_000).toISOString().slice(0, 10);

/** The gift card form: amount, who it's for, a message, when; then Paymob's secure page. */
export default function GiftCardClient({
  amounts,
  allowCustom,
  minAmount,
  maxAmount,
  allowScheduled,
  validMonths,
  online,
}: {
  amounts: number[];
  allowCustom: boolean;
  minAmount: number;
  maxAmount: number;
  allowScheduled: boolean;
  validMonths: number;
  online: boolean;
}) {
  const { format, currency } = useCurrency();
  const now = useMinuteClock();
  const [amount, setAmount] = useState<number | null>(amounts[1] ?? amounts[0] ?? null);
  const [custom, setCustom] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [sendOn, setSendOn] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A signed-in shopper's own details, as checkout does: what they've typed wins.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getBrowserSupabase();
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user || cancelled) return;
        if (user.email) setEmail((prev) => prev || user.email || "");
        const { data: row } = await supabase.from("customers").select("first_name, last_name, phone").eq("id", user.id).maybeSingle();
        if (cancelled || !row) return;
        const r = row as { first_name?: string | null; last_name?: string | null; phone?: string | null };
        if (r.first_name) {
          setFirstName((prev) => prev || r.first_name || "");
          setSenderName((prev) => prev || r.first_name || "");
        }
        if (r.last_name) setLastName((prev) => prev || r.last_name || "");
        if (r.phone) setPhone((prev) => prev || r.phone || "");
      } catch {
        // Signed out or unavailable: the shopper types their details.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chosen = amount ?? (custom ? Number(custom) : NaN);
  const customValid = allowCustom && custom !== "" && Number.isInteger(Number(custom)) && Number(custom) >= minAmount && Number(custom) <= maxAmount;
  const valueOk = amount !== null || customValid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!valueOk) {
      setError(`Choose an amount, or a whole amount from AED ${minAmount} to AED ${maxAmount}.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/gift-cards/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: chosen,
          recipientName,
          recipientEmail,
          senderName,
          message,
          sendOn: allowScheduled ? sendOn : "",
          firstName,
          lastName,
          email,
          phone,
          company,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; order_id?: string; error?: string; payment?: { returnPath?: string; redirectUrl?: string | null } } | null;
      const returnPath = json?.payment?.returnPath;
      if (res.ok && json?.ok && typeof returnPath === "string") {
        savePendingPayment({ path: returnPath, orderId: String(json.order_id ?? ""), expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
        window.history.replaceState(null, "", returnPath);
        const redirect = json.payment?.redirectUrl;
        window.location.assign(isPaymobCheckoutUrl(redirect) ? redirect : returnPath);
        return;
      }
      setError(json?.error || "We could not place your order. Please try again.");
      setBusy(false);
    } catch {
      setError("We could not reach the boutique. Please check your connection and try again.");
      setBusy(false);
    }
  };

  if (!online) {
    return (
      <section className="maison-container pb-20">
        <p className="maison-body mx-auto max-w-[52ch] text-center">
          Gift cards are paid online, and online payment is resting for a moment. Please come back soon, or write to us and a client advisor will help.
        </p>
      </section>
    );
  }

  return (
    <section className="maison-container pb-20 md:pb-28">
      <form onSubmit={submit} className="mx-auto flex max-w-[620px] flex-col gap-12">
        <input type="text" name="company" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="off" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

        <div>
          <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            Amount
          </h2>
          <div className="flex flex-wrap gap-3 pt-8">
            {amounts.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={amount === a}
                onClick={() => {
                  setAmount(a);
                  setCustom("");
                }}
                className={`h-12 min-w-[110px] px-5 text-[14px] ${amount === a ? "bg-black text-white" : "bg-white text-black hover:bg-[#F5F5F5]"}`}
                style={{ border: `1px solid ${amount === a ? "#000" : HAIRLINE}` }}
              >
                {format(a)}
              </button>
            ))}
          </div>
          {allowCustom ? (
            <div className="mt-6 max-w-[260px]">
              <label htmlFor="customAmount" className="maison-label">
                Another amount (AED {minAmount}–{maxAmount})
              </label>
              <input
                id="customAmount"
                inputMode="numeric"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value.replace(/[^0-9]/g, ""));
                  setAmount(null);
                }}
                className="maison-input"
                placeholder="250"
              />
            </div>
          ) : null}
          {currency !== "AED" ? <p className="pt-3 text-[12px] font-light text-[#646464]">Gift cards are issued and paid in UAE dirhams.</p> : null}
        </div>

        <div>
          <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            Who it&rsquo;s for
          </h2>
          <div className="grid grid-cols-1 gap-6 pt-8 md:grid-cols-2">
            <div>
              <label htmlFor="recipientName" className="maison-label">Their name</label>
              <input id="recipientName" required maxLength={120} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="maison-input" />
            </div>
            <div>
              <label htmlFor="recipientEmail" className="maison-label">Their email</label>
              <input id="recipientEmail" type="email" required value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="maison-input" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="giftMessage" className="maison-label">Your message (optional)</label>
              <textarea id="giftMessage" rows={3} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className="maison-input" style={{ height: "auto", paddingTop: 12, paddingBottom: 12 }} />
            </div>
            <div>
              <label htmlFor="senderName" className="maison-label">From</label>
              <input id="senderName" maxLength={120} value={senderName} onChange={(e) => setSenderName(e.target.value)} className="maison-input" placeholder="Your name" />
            </div>
            {allowScheduled ? (
              <div>
                <label htmlFor="sendOn" className="maison-label">Send on (optional)</label>
                <input
                  id="sendOn"
                  type="date"
                  min={now === null ? undefined : dubaiDay(now)}
                  max={now === null ? undefined : dubaiDay(now + 90 * 86400_000)}
                  value={sendOn}
                  onChange={(e) => setSendOn(e.target.value)}
                  className="maison-input"
                />
                <p className="pt-2 text-[12px] font-light text-[#646464]">Leave empty to send it as soon as your payment arrives.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            Your details
          </h2>
          <div className="grid grid-cols-1 gap-6 pt-8 md:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="maison-label">First name</label>
              <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="maison-input" />
            </div>
            <div>
              <label htmlFor="lastName" className="maison-label">Last name</label>
              <input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="maison-input" />
            </div>
            <div>
              <label htmlFor="email" className="maison-label">Email address</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="maison-input" />
            </div>
            <div>
              <label htmlFor="phone" className="maison-label">Phone number</label>
              <input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="maison-input" placeholder="+971 50 123 4567" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <p className="w-full text-[13px] font-light leading-[1.7] text-[#646464]">
            The card is valid for {validMonths} months and is spent at checkout like money. It can&rsquo;t be exchanged for cash.
          </p>
          <label htmlFor="accept" className="flex w-full items-start gap-3 text-[13px] font-light leading-[1.7] text-[#646464]">
            <input id="accept" type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" />
            <span>
              I accept the{" "}
              <Link href="/terms" className="maison-link" target="_blank">
                terms of use
              </Link>
              .
            </span>
          </label>
          {error ? (
            <p role="alert" className="w-full pl-4 text-[13px] font-light leading-[1.7] text-black" style={{ borderLeft: "1px solid #000" }}>
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy || !accepted} className="maison-btn w-full">
            {busy ? "Reserving your gift card" : `Continue to secure payment${valueOk ? ` · ${format(Number(chosen))}` : ""}`}
          </button>
        </div>
      </form>
    </section>
  );
}
