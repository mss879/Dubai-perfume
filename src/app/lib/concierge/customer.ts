import "server-only";
import { cookies } from "next/headers";
import { createSessionSupabase } from "../supabase-server";

/**
 * What the concierge knows about a returning customer.
 *
 * Everything here is gated twice. The database function scopes to auth.uid()
 * and takes no customer id at all (migration 56), and this module only calls it
 * when the request actually carries a Supabase session cookie — so an anonymous
 * shopper, which is nearly all of them, pays nothing: no cookie read of
 * consequence, no auth round-trip, no RPC.
 *
 * What comes back is deliberately thin. A first name, what they own, and their
 * scent profile. No address, no telephone, no email, no order totals. The agent
 * needs to know they already have Khamrah, not what they paid for it.
 */

export type ConciergeCustomerContext = {
  firstName: string | null;
  owns: {
    productId: number | null;
    name: string;
    brand: string;
    size: string;
    boughtOn: string;
    status: string;
  }[];
  scentProfile: Record<string, number>;
};

/**
 * A first name is shopper-supplied text that is about to be pasted into a
 * system prompt. Anything that is not a letter, a mark, an apostrophe, a hyphen
 * or a space is removed — which leaves every real name intact (including Arabic
 * and accented forms, hence the Unicode property escapes) and leaves nothing a
 * prompt injection could be built out of.
 */
/** The only axes the finder writes — see cleanProfile in api/quiz/route.ts. */
const PROFILE_KEYS = new Set([
  "fresh", "floral", "sweet", "amber", "woody", "spice", "intensity",
]);

export function safeFirstName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw
    .replace(/[^\p{L}\p{M}'\- ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return clean || null;
}

/** True when this request could plausibly belong to a signed-in shopper. */
async function hasSessionCookie(): Promise<boolean> {
  try {
    const store = await cookies();
    // @supabase/ssr names its cookies sb-<project-ref>-auth-token, and chunks
    // large ones with .0/.1 suffixes. Any of them means "worth asking".
    return store.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  } catch {
    return false;
  }
}

/**
 * The signed-in shopper's own context, or null.
 *
 * Never throws: an agent that cannot answer because the memory lookup failed is
 * worse than an agent with no memory.
 */
export async function fetchCustomerContext(
  sessionId: string,
  clientKey: string
): Promise<ConciergeCustomerContext | null> {
  try {
    if (!(await hasSessionCookie())) return null;

    const supabase = await createSessionSupabase();
    const { data, error } = await supabase.rpc("get_concierge_customer_context", {
      p_session_id: sessionId,
      p_client_key: clientKey,
    });
    if (error || !data || typeof data !== "object") return null;

    const raw = data as {
      firstName?: unknown;
      owns?: unknown;
      scentProfile?: unknown;
    };

    const owns = Array.isArray(raw.owns)
      ? raw.owns.slice(0, 20).map((o) => {
          const row = (o ?? {}) as Record<string, unknown>;
          return {
            productId: Number.isInteger(row.productId) ? (row.productId as number) : null,
            name: String(row.name ?? "").replace(/_/g, " ").slice(0, 80),
            brand: String(row.brand ?? "").slice(0, 40),
            size: String(row.size ?? "").slice(0, 20),
            boughtOn: String(row.boughtOn ?? "").slice(0, 30),
            status: String(row.status ?? "").slice(0, 30),
          };
        })
      : [];

    // The VALUES were always sanitised; the keys were not, and the keys are what
    // get pasted into the system prompt as labels. scent_profile is a jsonb
    // column written through an RPC granted to anon, so a caller who never
    // touches the finder can put a hundred characters of anything — newlines
    // included — into a key and have it read back as prompt text. The finder
    // only ever produces these seven, so nothing else is admitted.
    const profile: Record<string, number> = {};
    if (raw.scentProfile && typeof raw.scentProfile === "object") {
      for (const [k, v] of Object.entries(raw.scentProfile as Record<string, unknown>)) {
        if (!PROFILE_KEYS.has(k)) continue;
        const n = Number(v);
        if (Number.isFinite(n)) profile[k] = Math.round(n * 10) / 10;
      }
    }

    return { firstName: safeFirstName(raw.firstName), owns, scentProfile: profile };
  } catch {
    return null;
  }
}

/**
 * Render the context as the prompt section the agent reads.
 *
 * Two lists, and they do different jobs. `ownedLines` is prose the agent may
 * draw on in conversation, capped at eight so the section stays small. The flat
 * id line is the one that actually prevents the mistake: an agent that reads
 * "never stage these" as ids cannot re-recommend a bottle by getting the name
 * slightly wrong.
 */
export function describeCustomer(context: ConciergeCustomerContext | null): string | null {
  if (!context) return null;

  const parts: string[] = ["RETURNING CUSTOMER"];
  parts.push(
    "This shopper is signed in, and everything below is their own. The maison has already greeted them in the window — do NOT open with another greeting. You may use their first name at most once more, and only where it lands naturally."
  );
  parts.push(
    "Never recite their purchase history back to them, never mention a date or an order unless they raise it first, and never imply you can see anything beyond what is listed here. Someone who feels watched does not buy."
  );

  if (context.firstName) {
    parts.push(`Their first name is ${context.firstName}.`);
  }

  if (context.owns.length > 0) {
    const lines = context.owns
      .slice(0, 8)
      .map((o) => `${o.brand ? `${o.brand} ` : ""}${o.name}${o.size ? ` (${o.size})` : ""}, ${o.boughtOn}`);
    parts.push(`Already in their collection: ${lines.join("; ")}.`);

    const ids = context.owns
      .map((o) => o.productId)
      .filter((id): id is number => typeof id === "number");
    if (ids.length > 0) {
      parts.push(
        `Product ids they already own — never stage these and never add them to the bag unless they explicitly ask to repurchase: ${ids.join(", ")}. Recommend the companion or the next register instead.`
      );
    }
  }

  const profile = Object.entries(context.scentProfile)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (profile.length > 0) {
    parts.push(
      `Their scent profile from the finder, strongest first: ${profile
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}. Treat it as a starting point, not a verdict — taste moves.`
    );
  }

  return parts.join("\n");
}
