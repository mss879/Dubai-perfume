"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useFeature } from "../StoreFeaturesProvider";
import { fillTemplate } from "../../lib/features";
import { stashOfferCode } from "../../lib/offer-code";
import { notePageView, pagesThisVisit, readViewed, readVisit } from "../../lib/recently-viewed";

/**
 * The two quiet prompts the owner can switch on (Admin → Recently viewed,
 * Admin → Welcome offer): a "welcome back" note for a returning visitor, and
 * the welcome offer at the END of a visit, never on arrival. Neither appears
 * in the admin, at checkout or on the pre-launch page.
 */

const QUIET = /^\/(admin|checkout|launching-soon|recover|reorder|unsubscribe)(\/|$)/;
const subscribeNothing = () => () => {};

export default function GrowthOverlays() {
  const pathname = usePathname() || "/";
  const quiet = QUIET.test(pathname);

  // Each navigation is a page view of this visit (and refreshes "last seen").
  const [pages, setPages] = useState(0);
  useEffect(() => {
    if (quiet) return;
    const count = notePageView();
    const timer = setTimeout(() => setPages(count), 0);
    return () => clearTimeout(timer);
  }, [pathname, quiet]);

  if (quiet) return null;
  return (
    <>
      <WelcomeBack />
      <WelcomeOffer pages={pages} />
    </>
  );
}

/* ── "Welcome back. Still thinking about …?" ───────────────────────────── */

type Returning = { id: number; name: string } | null;
let returningSnapshot: Returning | undefined;

function WelcomeBack() {
  const settings = useFeature("recently_viewed");
  const hours = Number(settings?.welcome_back_hours) || 12;
  const enabled = Boolean(settings && settings.welcome_back);
  const returning = useSyncExternalStore(
    subscribeNothing,
    () => {
      if (returningSnapshot === undefined) {
        const visit = readVisit();
        const last = readViewed()[0];
        returningSnapshot =
          visit && visit.previousVisitAt && visit.startedAt - visit.previousVisitAt > hours * 3600_000 && last
            ? { id: last.id, name: last.name }
            : null;
      }
      return returningSnapshot;
    },
    () => null
  );
  const [dismissed, setDismissed] = useState(false);
  if (!enabled || !returning || dismissed) return null;
  const text = fillTemplate(String(settings?.welcome_back_text || "Welcome back. Still thinking about {name}?"), { name: returning.name });

  return (
    <div role="status" className="fixed bottom-5 left-5 z-[120] max-w-[340px] bg-white p-4 pr-10 shadow-[0_8px_30px_rgba(0,0,0,0.12)]" style={{ border: "1px solid rgba(0,0,0,0.12)" }}>
      <p className="text-[13px] font-light leading-[1.6] text-black">{text}</p>
      <Link href={`/product/${returning.id}`} onClick={() => setDismissed(true)} className="maison-link mt-2 inline-block">
        Take another look
      </Link>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Close" className="absolute right-3 top-3 text-[#646464] hover:text-black">
        <X className="h-4 w-4" strokeWidth={1.25} aria-hidden />
      </button>
    </div>
  );
}

/* ── The welcome offer ─────────────────────────────────────────────────── */

const HIDDEN_UNTIL = "gharib_welcome_hidden_until";
const DONE = "gharib_welcome_done";

function storedNumber(key: string): number {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function WelcomeOffer({ pages }: { pages: number }) {
  const settings = useFeature("welcome_offer");
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const shown = useRef(false);

  const delay = (Number(settings?.delay_seconds) || 45) * 1000;
  const minPages = Number(settings?.min_pages) || 2;
  const exitIntent = settings?.exit_intent !== false;
  const enabled = Boolean(settings);

  useEffect(() => {
    if (!enabled || shown.current || closed) return;
    if (storedNumber(DONE) > 0 || storedNumber(HIDDEN_UNTIL) > Date.now()) return;
    if (pages < minPages && pagesThisVisit() < minPages) return;
    const visit = readVisit();
    const wait = Math.max(0, (visit?.startedAt ?? Date.now()) + delay - Date.now());
    const touch = window.matchMedia("(pointer: coarse)").matches;
    let armed = false;
    const show = () => {
      if (shown.current) return;
      shown.current = true;
      setOpen(true);
    };
    const onLeave = (event: MouseEvent) => {
      if (armed && event.clientY <= 0 && !event.relatedTarget) show();
    };
    const timer = setTimeout(() => {
      armed = true;
      // On a phone there's no pointer heading for the tabs: the time and pages are the signal.
      if (touch || !exitIntent) show();
    }, wait);
    document.addEventListener("mouseout", onLeave);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mouseout", onLeave);
    };
  }, [enabled, pages, minPages, delay, exitIntent, closed]);

  if (!settings || !open || closed) return null;

  const close = () => {
    try {
      window.localStorage.setItem(HIDDEN_UNTIL, String(Date.now() + (Number(settings.hide_days) || 14) * 86400_000));
    } catch {}
    setClosed(true);
  };

  return <WelcomeCard settings={settings} onClose={close} />;
}

function WelcomeCard({ settings, onClose }: { settings: Record<string, unknown>; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string | null } | null>(null);
  const [company, setCompany] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), company }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; code?: string | null; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error || "We couldn't add you just now. Please try again.");
        return;
      }
      setResult({ code: json.code ?? null });
      if (json.code) stashOfferCode(json.code);
      try {
        window.localStorage.setItem(DONE, String(Date.now()));
      } catch {}
    } catch {
      setError("We couldn't reach the boutique. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[130] flex justify-center p-4 sm:bottom-6 sm:left-auto sm:right-6 sm:p-0">
      <div role="dialog" aria-modal="false" aria-labelledby="welcome-heading" className="relative w-full max-w-[420px] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.16)] sm:p-7" style={{ border: "1px solid rgba(0,0,0,0.12)" }}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-[#646464] hover:text-black">
          <X className="h-4 w-4" strokeWidth={1.25} aria-hidden />
        </button>
        <p className="maison-eyebrow">The Maison</p>
        <h2 id="welcome-heading" className="mt-3 font-display text-[18px] uppercase leading-[1.3] tracking-[0.08em] text-black">
          {String(settings.heading || "A welcome from the maison")}
        </h2>
        {result ? (
          <div className="mt-4">
            {result.code ? (
              <>
                <p className="text-[14px] font-light leading-[1.7] text-black">{String(settings.success || "Your welcome code is below.")}</p>
                <p className="mt-4 py-3 text-center font-mono text-[18px] tracking-[0.12em] text-black" style={{ border: "1px solid rgba(0,0,0,0.12)" }}>
                  {result.code}
                </p>
                <p className="mt-3 text-[12px] font-light text-[#646464]">It&rsquo;s waiting for you at checkout. {String(settings.fine_print || "")}</p>
              </>
            ) : (
              <p className="text-[14px] font-light leading-[1.7] text-black">Thank you. You&rsquo;re on the list: you&rsquo;ll hear about new arrivals first.</p>
            )}
            <button type="button" onClick={onClose} className="maison-btn-outline mt-5 w-full">
              Continue
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3">
            <p className="text-[14px] font-light leading-[1.7] text-black">{String(settings.body || "")}</p>
            <input
              type="text"
              name="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            />
            <label htmlFor="welcome-email" className="maison-label mt-5">
              Email address
            </label>
            <input id="welcome-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="maison-input" placeholder="email@example.com" />
            {error ? (
              <p role="alert" className="mt-2 text-[12px] text-black">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="maison-btn mt-5 w-full">
              {busy ? "One moment" : String(settings.button || "Send my welcome")}
            </button>
            {settings.fine_print ? <p className="mt-3 text-[11px] font-light text-[#646464]">{String(settings.fine_print)}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}
