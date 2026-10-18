"use client";

import { useState } from "react";

export default function UnsubscribeClient({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const confirm = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token }) });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };
  if (state === "done") {
    return (
      <p className="maison-body mx-auto mt-6 max-w-[52ch]" role="status">
        Done. {email} won&rsquo;t receive reorder reminders, birthday notes or cart reminders from us. Order emails still arrive as usual.
      </p>
    );
  }
  return (
    <div className="mx-auto mt-6 max-w-[52ch]">
      <p className="maison-body">
        Stop reorder reminders, birthday notes and cart reminders for <span className="text-black">{email}</span>? Emails about your orders still arrive.
      </p>
      <button type="button" onClick={confirm} disabled={state === "busy"} className="maison-btn mt-8">
        {state === "busy" ? "One moment" : "Unsubscribe"}
      </button>
      {state === "error" ? (
        <p role="alert" className="mt-4 text-[13px] text-black">
          That didn&rsquo;t work just now. Please try again in a moment.
        </p>
      ) : null}
    </div>
  );
}
