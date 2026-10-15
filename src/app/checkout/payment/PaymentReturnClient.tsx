"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { readPendingPayment, type PendingPayment } from "../../lib/payments/pending-payment";

const HAIRLINE = "rgba(0,0,0,0.12)";

const subscribeToNothing = () => () => {};

/** Resolved once: useSyncExternalStore needs the same object back every time. */
let snapshot: PendingPayment | null | undefined;
function getPending(): PendingPayment | null {
  if (snapshot === undefined) snapshot = readPendingPayment();
  return snapshot;
}

/**
 * Forwards to the order's own payment page when this browser left one for
 * Paymob; otherwise explains what happens next. The query string Paymob
 * appended is dropped either way.
 */
export default function PaymentReturnClient() {
  // undefined on the server, then the browser's answer.
  const pending = useSyncExternalStore<PendingPayment | null | undefined>(
    subscribeToNothing,
    getPending,
    () => undefined
  );

  useEffect(() => {
    if (pending) {
      window.location.replace(`${pending.path}?returned=1`);
    } else if (pending === null && window.location.search) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [pending]);

  const forwarding = pending !== null;

  return (
    <div className="maison-container maison-section">
      <div className="mx-auto max-w-[620px] text-center" role="status">
        <p className="maison-eyebrow">Payment</p>
        <h1 className="maison-page-title mt-5">{forwarding ? "Confirming your payment" : "Thank you"}</h1>
        <div className="mt-10 pt-10" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          {forwarding ? (
            <p className="maison-body">One moment while we bring up your order.</p>
          ) : (
            <>
              <p className="maison-body">
                We are confirming your payment with our payment partner. If it went through, a confirmation
                will reach your inbox within a few minutes. You can follow your order with its reference and
                the email address you used.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/track" className="maison-btn w-full sm:w-auto">
                  Track your order
                </Link>
                <Link href="/shop" className="maison-btn-outline w-full sm:w-auto">
                  Back to the boutique
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
