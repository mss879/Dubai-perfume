"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "../../lib/supabase-browser";
import { useCurrency } from "../../lib/currency";
import { useFeature } from "../../components/StoreFeaturesProvider";
import { SITE_URL } from "../../lib/site";

const HAIRLINE = "rgba(0,0,0,0.12)";

type Rewards = {
  birthday: string | null;
  loyalty: {
    enabled: boolean;
    program_name: string;
    available: number;
    pending: number;
    earn_points: number;
    earn_per_aed: number;
    redeem_points: number;
    redeem_value_aed: number;
    min_redeem: number;
    birthday_points: number;
    history: { points: number; kind: string; note: string | null; order_id: string | null; created_at: string; available_at: string }[];
  };
  referral: { enabled: boolean; code: string | null; friend_reward: number; friend_min_order: number; referrer_reward: number; friends: number; rewarded: number; earned: number };
  gift_cards: { code: string; kind: string; balance: number; initial_value: number; expires_at: string | null }[];
};

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(new Date(iso)) : "";

const KIND_WORDS: Record<string, string> = {
  earn: "Earned",
  redeem: "Spent",
  restore: "Given back",
  reverse: "Taken back",
  birthday: "Birthday gift",
  bonus: "Bonus",
  adjust: "From the maison",
  expire: "Expired",
};

/** Account → Rewards: points, the referral link, gift cards and credit, and a birthday. */
export default function RewardsPanel({ userId }: { userId: string }) {
  const { format } = useCurrency();
  const referralsOn = Boolean(useFeature("referrals"));
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [birthday, setBirthday] = useState("");
  const [birthdayNote, setBirthdayNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBrowserSupabase()
      .rpc("my_rewards")
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (cancelled) return;
        if (error || !data) {
          setFailed(true);
          return;
        }
        const r = data as Rewards;
        setRewards(r);
        setCode(r.referral?.code ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const makeCode = async () => {
    setMaking(true);
    const { data } = await getBrowserSupabase().rpc("my_referral_code");
    setMaking(false);
    const made = data as { code?: string } | null;
    if (made?.code) setCode(made.code);
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const saveBirthday = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return;
    const { error } = await getBrowserSupabase().from("customers").update({ birthday }).eq("id", userId);
    if (error) {
      setBirthdayNote("We couldn't save that just now. Please try again.");
      return;
    }
    setRewards((r) => (r ? { ...r, birthday } : r));
    setBirthdayNote("Saved. We'll remember it.");
  };

  if (failed) return <p className="maison-body">Your rewards couldn&rsquo;t be loaded just now. Please try again later.</p>;
  if (!rewards) return <div className="h-40 bg-[#F5F5F5]" />;

  const l = rewards.loyalty;
  const r = rewards.referral;
  const blocks = Math.floor(l.available / Math.max(1, l.redeem_points));
  const worth = blocks * l.redeem_value_aed;
  const link = code ? `${SITE_URL}/r/${code}` : null;

  return (
    <div className="flex flex-col gap-14">
      {l.enabled ? (
        <section>
          <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            {l.program_name}
          </h2>
          <div className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-3">
            <div>
              <p className="font-display text-[28px] text-black">{l.available.toLocaleString("en-AE")}</p>
              <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">Points to spend</p>
            </div>
            <div>
              <p className="font-display text-[28px] text-black">{format(worth)}</p>
              <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">Worth at checkout</p>
            </div>
            <div>
              <p className="font-display text-[28px] text-black">{l.pending.toLocaleString("en-AE")}</p>
              <p className="text-[12px] uppercase tracking-[0.1em] text-[#646464]">On their way</p>
            </div>
          </div>
          <p className="mt-6 text-[13px] font-light leading-[1.8] text-[#646464]">
            Earn {l.earn_points} {l.earn_points === 1 ? "point" : "points"} for every AED {l.earn_per_aed} spent, added once your order is delivered.{" "}
            {l.redeem_points.toLocaleString("en-AE")} points take {format(l.redeem_value_aed)} off at checkout
            {l.min_redeem > 0 ? `, from ${l.min_redeem.toLocaleString("en-AE")} points` : ""}.
          </p>
          {l.history.length > 0 ? (
            <ul className="mt-6">
              {l.history.map((h, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 border-t py-3 text-[13px] font-light" style={{ borderColor: HAIRLINE }}>
                  <span className="text-black">
                    {KIND_WORDS[h.kind] ?? h.kind}
                    {h.note ? <span className="text-[#646464]"> · {h.note}</span> : null}
                    <span className="block text-[11px] text-[#646464]">{day(h.created_at)}</span>
                  </span>
                  <span className={h.points > 0 ? "text-black" : "text-[#646464]"}>
                    {h.points > 0 ? "+" : ""}
                    {h.points.toLocaleString("en-AE")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {l.birthday_points > 0 ? (
            <div className="mt-8 bg-[#F5F5F5] p-5">
              <p className="text-[13px] font-normal text-black">A birthday gift</p>
              {rewards.birthday ? (
                <p className="mt-2 text-[13px] font-light text-[#646464]">
                  {l.birthday_points.toLocaleString("en-AE")} points arrive on your birthday ({new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(`${rewards.birthday}T00:00:00Z`))}).
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[13px] font-light text-[#646464]">
                    Tell us your birthday and {l.birthday_points.toLocaleString("en-AE")} points arrive on the day. You can set it once.
                  </p>
                  <div className="mt-3 flex flex-wrap items-stretch gap-3">
                    <label htmlFor="birthday" className="sr-only">
                      Birthday
                    </label>
                    <input id="birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="maison-input max-w-[200px] bg-white" />
                    <button type="button" onClick={saveBirthday} disabled={!birthday} className="maison-btn-outline">
                      Save
                    </button>
                  </div>
                  {birthdayNote ? <p className="mt-2 text-[12px] text-black">{birthdayNote}</p> : null}
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {referralsOn && r.enabled ? (
        <section>
          <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            Give {format(r.friend_reward)}, get {format(r.referrer_reward)}
          </h2>
          <p className="pt-8 text-[14px] font-light leading-[1.8] text-black">
            Share your code. A friend saves {format(r.friend_reward)} on a first order
            {r.friend_min_order > 0 ? ` of ${format(r.friend_min_order)} or more` : ""}, and once it&rsquo;s delivered you receive {format(r.referrer_reward)} to spend.
          </p>
          {code && link ? (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-4 py-3 font-mono text-[16px] tracking-[0.12em] text-black" style={{ border: `1px solid ${HAIRLINE}` }}>
                  {code}
                </span>
                <button type="button" onClick={() => copy(code, "code")} className="maison-link">
                  {copied === "code" ? "Copied" : "Copy code"}
                </button>
                <button type="button" onClick={() => copy(link, "link")} className="maison-link">
                  {copied === "link" ? "Copied" : "Copy link"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`A gift for your first Gharib order: ${link}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="maison-link"
                >
                  Share on WhatsApp
                </a>
              </div>
              <p className="text-[12px] font-light text-[#646464]">
                {r.friends} {r.friends === 1 ? "friend has" : "friends have"} ordered with your code · {r.rewarded} {r.rewarded === 1 ? "reward" : "rewards"} ({format(r.earned)})
              </p>
            </div>
          ) : (
            <button type="button" onClick={makeCode} disabled={making} className="maison-btn mt-6">
              {making ? "One moment" : "Get my referral code"}
            </button>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="maison-eyebrow pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          Gift cards and credit
        </h2>
        {rewards.gift_cards.length === 0 ? (
          <p className="pt-8 text-[13px] font-light text-[#646464]">
            Nothing here yet. Gift cards sent to this email, and referral credit, appear here to use at checkout.{" "}
            <Link href="/gift-cards" className="maison-link">
              Send a gift card
            </Link>
          </p>
        ) : (
          <ul className="pt-4">
            {rewards.gift_cards.map((g) => (
              <li key={g.code} className="flex flex-wrap items-baseline justify-between gap-3 border-t py-4" style={{ borderColor: HAIRLINE }}>
                <span>
                  <span className="block font-mono text-[14px] tracking-[0.08em] text-black">{g.code}</span>
                  <span className="text-[12px] font-light text-[#646464]">
                    {g.kind === "reward" ? "Referral credit" : "Gift card"}
                    {g.expires_at ? ` · valid until ${day(g.expires_at)}` : ""}
                  </span>
                </span>
                <span className="flex items-baseline gap-4">
                  <span className="text-[14px] text-black">{format(g.balance)}</span>
                  <button type="button" onClick={() => copy(g.code, g.code)} className="maison-link">
                    {copied === g.code ? "Copied" : "Copy"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
