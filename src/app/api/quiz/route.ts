import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createSessionSupabase,
  isSupabaseConfigured,
} from "../../lib/supabase-server";
import { isMissingFunction } from "../../lib/rpc-errors";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";
import { isBot, readJsonBody } from "../../lib/request-guard";
import { sendEmail } from "../../lib/email/send";
import { quizResultsEmail, type QuizResultLine } from "../../lib/email/templates";
import { QUIZ_QUESTIONS, recommend, type QuestionId, type QuizAnswers } from "../../lib/quiz";
import { fetchQuizCatalogue } from "../../lib/quiz-catalogue";

/**
 * Fragrance finder capture.
 *
 * Called twice for one quiz: once when the results appear (answers only) and
 * again if the shopper asks for them by email. Both carry the same sessionId,
 * and record_quiz_response() upserts on it — so a shopper is one row, and the
 * answers are kept whether or not an address ever follows.
 *
 * When an address does follow, the three recommendations are re-read from the
 * catalogue here before they are sent. The browser says WHICH products; the
 * server decides what they are called and what they cost.
 */

type QuizBody = {
  sessionId?: unknown;
  answers?: unknown;
  recommended?: unknown;
  email?: unknown;
  /**
   * Accepted for backwards compatibility with the deployed client and then
   * IGNORED. The results email re-derives its own sentences — see sendResults.
   */
  reasons?: unknown;
  /** How the finder read the shopper — six axes plus a sillage target. */
  profile?: unknown;
  company?: unknown;
};

const MAX_SUBMISSIONS_PER_IP = 20;
const SUBMISSIONS_WINDOW_SECONDS = 3600;

/** The finder shows three; the email says the same three and no more. */
const MAX_EMAIL_LINES = 3;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const VALID_ANSWERS = new Map<QuestionId, Set<string>>(
  QUIZ_QUESTIONS.map((q) => [q.id, new Set(q.options.map((o) => o.value))])
);

/** Keeps only answers the quiz could actually have produced. */
function cleanAnswers(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [id, allowed] of VALID_ANSWERS) {
    const value = source[id];
    if (typeof value === "string" && allowed.has(value)) out[id] = value;
  }
  return out;
}

/** The axes the finder reads on, plus the sillage it settled on. */
const PROFILE_KEYS = ["fresh", "floral", "sweet", "amber", "woody", "spice", "intensity"];

/** Keeps only finite numbers on the known keys, rounded and clamped to 0–10. */
function cleanProfile(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of PROFILE_KEYS) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) {
      out[key] = Math.round(Math.max(0, Math.min(10, value)) * 10) / 10;
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const parsed = await readJsonBody<QuizBody>(request);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false }, { status: parsed.status });
  }
  const body = parsed.body;

  // Honeypot, answered like any other validation failure.
  if (isBot(body.company)) {
    return NextResponse.json({ ok: true });
  }

  const sessionId = String(body.sessionId ?? "").trim();
  if (!UUID.test(sessionId)) {
    return NextResponse.json({ ok: false }, { status: 422 });
  }

  const answers = cleanAnswers(body.answers);
  const recommended = Array.isArray(body.recommended)
    ? body.recommended
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 12)
    : [];

  const rawEmail = String(body.email ?? "").trim();
  const email = EMAIL.test(rawEmail) && rawEmail.length <= 255 ? rawEmail : null;

  const supabase = createServerSupabase();
  if (
    !(await checkRateLimit(
      supabase,
      `quiz:ip:${clientKey(request)}`,
      MAX_SUBMISSIONS_PER_IP,
      SUBMISSIONS_WINDOW_SECONDS
    ))
  ) {
    return NextResponse.json(
      { ok: false, error: "Please wait a little before trying again." },
      { status: 429 }
    );
  }

  // Who took this quiz, if anyone signed in did.
  //
  // Read from the cookie session and nowhere else — a customer id in the
  // request body would let anyone attach their taste to a stranger's account.
  // Only this one call uses the session client; the rate limit and the
  // catalogue read stay on the anon client, which is all they need.
  let customerId: string | null = null;
  try {
    const session = await createSessionSupabase();
    const { data } = await session.auth.getUser();
    customerId = data.user?.id ?? null;
  } catch {
    // Signed out, or auth unreachable. The result is still captured, just
    // without an owner — exactly as it behaved before this was added.
  }

  const { error } = await supabase.rpc("record_quiz_response", {
    p_session_id: sessionId,
    p_answers: answers,
    p_email: email,
    p_recommended: recommended,
    p_profile: cleanProfile(body.profile),
    p_customer_id: customerId,
  });

  if (error) {
    if (isMissingFunction(error)) {
      // Migration 46 shipped this function with a broken ON CONFLICT clause;
      // 47 replaces it with the five-argument version called here.
      console.error("record_quiz_response(…, p_profile) is missing — apply migration 47.");
    } else {
      console.error("Quiz response capture failed:", error.message);
    }
    // The shopper has their results on screen either way; failing the capture
    // must not read to them as the quiz having failed.
    return NextResponse.json(
      { ok: false, error: "We could not save that just now. Your results are still on screen." },
      { status: 503 }
    );
  }

  if (!email) {
    return NextResponse.json({ ok: true, emailed: false });
  }

  // body.reasons is deliberately NOT passed on. See sendResults.
  const emailed = await sendResults(supabase, email, recommended, answers);
  return NextResponse.json({ ok: true, emailed });
}

/**
 * Sends the three. Never throws into the request: the address is already
 * captured, so a mail failure costs the message, not the subscriber.
 */
async function sendResults(
  supabase: ReturnType<typeof createServerSupabase>,
  email: string,
  recommended: number[],
  answers: Record<string, string>
): Promise<boolean> {
  if (recommended.length === 0) return false;

  try {
    // One product per line, at most the three the finder actually shows. The
    // request could otherwise name the same id twelve times and turn one
    // message into twelve rows of prose.
    const ids = [...new Set(recommended)].slice(0, MAX_EMAIL_LINES);

    const { data: products } = await supabase
      .from("products")
      .select("id, brand, name, price")
      .in("id", ids);

    const byId = new Map(
      ((products ?? []) as { id: number; brand: string | null; name: string; price: number | string }[]).map(
        (p) => [p.id, p]
      )
    );

    /**
     * The reason sentences are RE-DERIVED here, never taken from the request.
     *
     * They used to come from body.reasons, which made this endpoint an
     * unauthenticated mailer: anyone could post someone else's address with
     * their own prose and have it arrive DKIM-signed from the maison's domain.
     * Re-running recommend() over the same catalogue and the same validated
     * answers reproduces the sentence the shopper actually saw, and the only
     * text that can reach the message now is text this codebase wrote.
     */
    const reasonById = new Map<number, string>();
    try {
      const catalogue = await fetchQuizCatalogue();
      for (const match of recommend(catalogue, answers as QuizAnswers, MAX_EMAIL_LINES)) {
        reasonById.set(match.product.id, match.reason);
      }
    } catch (err) {
      // A generic sentence is a smaller loss than no email.
      console.error("[quiz] could not re-derive reasons:", err);
    }

    // Ordered as the finder ranked them, not as the database returned them.
    const lines: QuizResultLine[] = ids
      .map((id) => {
        const product = byId.get(id);
        if (!product) return null;
        return {
          productId: product.id,
          brand: product.brand,
          name: product.name,
          priceAed: Number(product.price) || 0,
          reason: reasonById.get(id) || "Chosen for the balance of your answers.",
        };
      })
      .filter((l): l is QuizResultLine => l !== null);

    if (lines.length === 0) return false;

    // The shopper's answers in their own words, in question order.
    const described = QUIZ_QUESTIONS.map((q) => {
      const option = q.options.find((o) => o.value === answers[q.id]);
      return option ? option.label : "";
    }).filter(Boolean);

    const result = await sendEmail({ to: email, ...quizResultsEmail({ lines, answers: described }) });
    if (!result.ok) {
      console.error(`[quiz] results not sent to ${email}: ${result.reason}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[quiz] results email failed:", err);
    return false;
  }
}
