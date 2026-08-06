import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";
import { isBot, readJsonBody } from "../../lib/request-guard";
import { toTitleCase } from "../../lib/catalogue";
import { FREE_SHIPPING_THRESHOLD_AED } from "../../lib/shipping";
import { getConciergeCatalogue, resolveCards } from "../../lib/concierge/catalogue";
import { buildSystemPrompt } from "../../lib/concierge/prompt";
import {
  getConciergeModel,
  getConciergeVisionModel,
  isModelConfigured,
  isVisionEnabled,
  CONCIERGE_MODEL_ID,
  CONCIERGE_VISION_MODEL_ID,
  CONCIERGE_PROVIDER_OPTIONS,
} from "../../lib/concierge/model";
import { buildTools, createCollector, STEP_BUDGET } from "../../lib/concierge/tools";
import { FAILED_SIGNALS, logConciergeTurn, readTurnSignals } from "../../lib/concierge/insights";
import { describeCustomer, fetchCustomerContext } from "../../lib/concierge/customer";
import type {
  ConciergeHistoryMessage,
  ConciergeImage,
  ConciergeRequest,
  ConciergeResponse,
  ConciergeStage,
} from "../../lib/concierge/types";

/**
 * The perfume concierge.
 *
 * One POST per shopper message. The reply is a complete JSON envelope —
 * text, what to put on the stage, quick-reply chips, cart effects — rather
 * than a stream, because every visual element in it must first be resolved
 * against the database (see lib/concierge/tools.ts on the collector). The
 * model runs a short tool loop (search → stock → stage → chips) and the
 * route answers when the loop settles.
 *
 * Shape and guards mirror /api/quiz: body cap, honeypot, session UUID,
 * database-backed rate limits, fail-soft logging through a SECURITY DEFINER
 * function (migration 53), and friendly copy on every failure path — a
 * shopper never sees an internal error, only the concierge stepping away.
 */

/**
 * The host kills a function that outruns its budget, and a killed function
 * answers with its own error page rather than the copy below. 26s is the
 * ceiling this route plans against; every model call inside it aborts sooner.
 */
export const maxDuration = 26;

/** Friendly copy for every way this can fail. */
const AWAY = "The concierge is away from the desk just now. Please try again in a moment.";
const BUSY = "A moment, please — the concierge will be right with you.";
const STUMBLED = "The concierge could not reply just now. Please try again in a moment.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Larger than the shared 64KB cap because a turn may carry a photograph.
 * Note this alone does not bound the function's memory: proxy.ts matches
 * every route, and Next buffers a proxied body up to `proxyClientMaxBodySize`
 * (10MB by default) BEFORE readJsonBody's streaming cap ever runs. That value
 * is pinned in next.config.ts; the two must be read together.
 */
const CONCIERGE_MAX_BODY_BYTES = 512 * 1024;

/** What an order reference looks like: ORD-10001, and nothing more exotic. */
const ORDER_REF_SHAPE = /^[A-Za-z0-9][A-Za-z0-9-]{2,30}$/;

/**
 * Photograph limits. MAX_IMAGE_BASE64 is the same ceiling prepareImage.ts aims
 * under; base64 costs 4/3 of the bytes, so 400,000 characters is about 300KB of
 * JPEG, comfortably inside the 512KB body above with a transcript alongside.
 */
const MAX_IMAGE_BASE64 = 400_000;
const MIN_IMAGE_BASE64 = 512;
const BASE64_ONLY = /^[A-Za-z0-9+/]+={0,2}$/;

/** An image turn is the most expensive thing here, so it gets its own budget. */
const MAX_IMAGES_PER_IP = 6;
const IMAGE_IP_WINDOW_SECONDS = 900;
const MAX_IMAGES_PER_SESSION = 12;
const IMAGE_SESSION_WINDOW_SECONDS = 3600;

const PHOTO_UNAVAILABLE =
  "I could not read that photograph just now — tell me about the bottle instead and I will find its register.";

/**
 * How long the whole turn may take, leaving room under maxDuration for the
 * logging round-trip and serialising the reply.
 *
 * The retry budget is whatever is LEFT rather than a slice reserved up front.
 * Reserving time for it starved the path that actually matters: a photograph
 * turn runs identify → search → stock → stage → chips and genuinely needs most
 * of the window, and the one failure a retry can rescue — a model that refuses
 * images outright — errors in well under a second, so there is always plenty
 * left when it happens. A timeout leaves nothing, and that path skips the retry
 * anyway because the budget really is spent.
 */
const TURN_BUDGET_MS = 24_000;
const MIN_RETRY_MS = 4_000;

/** null for "no image", "invalid" for one that should be refused outright. */
function parseImage(raw: unknown): ConciergeImage | null | "invalid" {
  if (raw == null) return null;
  if (typeof raw !== "object") return "invalid";
  const candidate = raw as { mediaType?: unknown; data?: unknown };
  if (candidate.mediaType !== "image/jpeg") return "invalid";
  if (typeof candidate.data !== "string") return "invalid";
  const data = candidate.data.trim();
  if (data.length < MIN_IMAGE_BASE64 || data.length > MAX_IMAGE_BASE64) return "invalid";
  // The provider would reject a malformed payload anyway; refusing it here
  // means not paying for the round trip to find out.
  if (!BASE64_ONLY.test(data)) return "invalid";
  return { mediaType: "image/jpeg", data };
}

/** Enough for a chatty human, hostile to a script. Two buckets: burst and session. */
const MAX_PER_IP = 20;
const IP_WINDOW_SECONDS = 300;
const MAX_PER_SESSION = 80;
const SESSION_WINDOW_SECONDS = 3600;

/** History the model sees: recent, and bounded per message. */
const MAX_HISTORY = 12;
const MAX_USER_CHARS = 1000;
const MAX_ASSISTANT_CHARS = 2500;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error } satisfies ConciergeResponse, { status });
}

/** Keeps only well-formed turns, bounded, ending on the user. */
function clampHistory(raw: unknown): ConciergeHistoryMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const clean: ConciergeHistoryMessage[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    clean.push({
      role,
      content: trimmed.slice(0, role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS),
    });
  }
  const recent = clean.slice(-MAX_HISTORY);
  if (recent.length === 0 || recent[recent.length - 1].role !== "user") return null;
  return recent;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  if (!isSupabaseConfigured || !isModelConfigured) {
    return fail(503, AWAY);
  }

  const parsed = await readJsonBody<ConciergeRequest>(request, CONCIERGE_MAX_BODY_BYTES);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: STUMBLED }, { status: parsed.status });
  }
  const body = parsed.body;

  // `JSON.parse("null")` and `JSON.parse("[]")` both parse cleanly, and every
  // check below reads a property off this. Refuse anything that is not an object.
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail(422, STUMBLED);
  }

  // Honeypot: answered like a success, learned from like a failure.
  if (isBot(body.company)) {
    return NextResponse.json({ ok: true, content: "" } satisfies ConciergeResponse);
  }

  const sessionId = String(body.sessionId ?? "").trim();
  if (!UUID.test(sessionId)) {
    return fail(422, STUMBLED);
  }

  const history = clampHistory(body.messages);
  if (!history) {
    return fail(422, STUMBLED);
  }

  const page =
    typeof body.page === "string" && body.page.startsWith("/") && body.page.length <= 120
      ? body.page
      : null;

  const viewedIds = Array.isArray(body.viewedProductIds)
    ? body.viewedProductIds
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 12)
    : [];

  // Analytics only. Nothing is rendered from these and no money depends on them,
  // but they are still filtered against the catalogue below before being filed —
  // a bogus id would otherwise sit in the demand table forever.
  const tappedIdsRaw = Array.isArray(body.tappedProductIds)
    ? body.tappedProductIds
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 12)
    : [];

  // Advisory only: it lets the agent say "another AED 15 and delivery is free".
  // Nothing is charged from it — place_order recomputes every figure from the
  // cart it is actually sent — so a forged value costs the forger a wrong
  // sentence and nothing else. Clamped so it cannot be used to make the agent
  // recite an absurd total.
  const rawSubtotal = Number(body.cartSubtotalAed);
  const cartSubtotalAed =
    Number.isFinite(rawSubtotal) && rawSubtotal > 0
      ? Math.min(Math.round(rawSubtotal * 100) / 100, 100_000)
      : null;

  const parsedImage = parseImage(body.image);
  if (parsedImage === "invalid") {
    return fail(422, STUMBLED);
  }
  // Vision switched off in the environment means the photograph is dropped, not
  // that the turn fails — the shopper still gets an answer to what they typed.
  // But it is said out loud: dropping a picture in silence has the agent reply
  // as though nothing was sent, which reads as the agent ignoring them.
  const image = isVisionEnabled ? parsedImage : null;
  const visionRefused = Boolean(parsedImage) && !isVisionEnabled;

  const supabase = createServerSupabase();
  const key = clientKey(request);

  const [ipAllowed, sessionAllowed] = await Promise.all([
    checkRateLimit(supabase, `concierge:ip:${key}`, MAX_PER_IP, IP_WINDOW_SECONDS),
    checkRateLimit(supabase, `concierge:session:${sessionId}`, MAX_PER_SESSION, SESSION_WINDOW_SECONDS),
  ]);
  if (!ipAllowed || !sessionAllowed) {
    return fail(429, BUSY);
  }

  // A second, much tighter budget for photographs. They cost several times what
  // a text turn does, so the ordinary limits are far too generous for them.
  if (image) {
    const [imgIpAllowed, imgSessionAllowed] = await Promise.all([
      checkRateLimit(supabase, `concierge:img:ip:${key}`, MAX_IMAGES_PER_IP, IMAGE_IP_WINDOW_SECONDS),
      checkRateLimit(
        supabase,
        `concierge:img:session:${sessionId}`,
        MAX_IMAGES_PER_SESSION,
        IMAGE_SESSION_WINDOW_SECONDS
      ),
    ]);
    if (!imgIpAllowed || !imgSessionAllowed) {
      return fail(429, BUSY);
    }
  }

  // The catalogue is cached; the customer lookup costs nothing at all for an
  // anonymous shopper (it returns early on a missing session cookie), so the
  // two run together rather than the second waiting on the first.
  const [snapshot, customerContext] = await Promise.all([
    getConciergeCatalogue(),
    fetchCustomerContext(sessionId, key),
  ]);
  if (!snapshot || snapshot.scored.length === 0) {
    return fail(503, AWAY);
  }
  const customerSection = describeCustomer(customerContext);

  // What shelf is the shopper standing at?
  let pageProductLine: string | null = null;
  const productMatch = page?.match(/^\/product\/(\d+)$/);
  if (productMatch) {
    const p = snapshot.byId.get(Number(productMatch[1]));
    if (p) {
      pageProductLine = `${toTitleCase(p.brand)} — ${p.name.replace(/_/g, " ")}, AED ${Math.round(p.price)} (id ${p.id})`;
    }
  }
  const viewedLines = viewedIds
    .map((id) => snapshot.byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => `#${p.id} ${toTitleCase(p.brand)} ${p.name.replace(/_/g, " ")}`);

  const tappedIds = tappedIdsRaw.filter((id) => snapshot.byId.has(id));

  const bagLine =
    cartSubtotalAed != null
      ? `Their bag currently comes to AED ${Math.round(cartSubtotalAed)}${
          cartSubtotalAed < FREE_SHIPPING_THRESHOLD_AED
            ? ` — AED ${Math.round(FREE_SHIPPING_THRESHOLD_AED - cartSubtotalAed)} short of complimentary delivery.`
            : ", which already qualifies for complimentary delivery."
        }`
      : null;

  /**
   * The same history, with the photograph attached to the final user turn.
   *
   * Only that turn: replaying an image through the transcript would be paid for
   * on every subsequent message and would have the model re-identify a bottle
   * it already named. What it read survives as text instead, via
   * record_photo_reading and the bracketed note the widget appends.
   *
   * FilePart rather than the deprecated ImagePart, which ai@7 marks for removal.
   */
  const withImageMessages: ModelMessage[] = image
    ? [
        ...history.slice(0, -1),
        {
          role: "user",
          content: [
            { type: "text", text: history[history.length - 1].content },
            {
              type: "file",
              mediaType: image.mediaType,
              data: { type: "data", data: image.data },
            },
          ],
        },
      ]
    : [];

  /**
   * One pass at the model, collector and all.
   *
   * The collector is built INSIDE so a throw can never leave a half-populated
   * one in scope for the caller to read — and so a retry starts from a clean
   * stage rather than inheriting whatever the failed attempt staged.
   */
  // An arrow const, not a function declaration: a hoisted declaration would be
  // analysed before the null guards above, so `snapshot` and `history` would
  // still read as nullable inside it.
  const attempt = async (withImage: boolean, retry = false) => {
    // Reported back so the classifier compares against the cap this turn really
    // ran under, and the log records the model that really answered.
    const stepBudget = retry ? STEP_BUDGET.retry : withImage ? STEP_BUDGET.photo : STEP_BUDGET.text;
    const modelId = withImage ? CONCIERGE_VISION_MODEL_ID : CONCIERGE_MODEL_ID;
    const collector = createCollector();
    const tools = buildTools({
      snapshot,
      supabase,
      collector,
      sessionId,
      clientKey: key,
      cartSubtotalAed,
      hasImage: withImage,
    });

    const generation = await generateText({
      model: withImage ? getConciergeVisionModel() : getConciergeModel(),
      providerOptions: CONCIERGE_PROVIDER_OPTIONS,
      system: buildSystemPrompt({
        digest: snapshot.digest,
        page,
        pageProductLine,
        viewedLines,
        bagLine,
        customerSection,
        hasPhoto: withImage,
      }),
      messages: withImage ? withImageMessages : history,
      tools,
      // A full closing turn is recommend → stock → stage → add → chips → text.
      stopWhen: stepCountIs(stepBudget),
      maxOutputTokens: 700,
      // Both attempts share one deadline measured from the top of the request,
      // so a retry can never extend the turn past it. The caller refuses to
      // retry at all when too little is left — see msLeft() below.
      abortSignal: AbortSignal.timeout(retry ? msLeft() : TURN_BUDGET_MS),
    });

    // The widget appends bracketed memory traces ("[You showed …]") to the
    // history it sends; a model will sometimes imitate its own notes. They
    // are internal — never shopper-facing — so any echo is removed here.
    const text = generation.text
      .replace(/^\[You (?:showed|asked|put)[^\]]*\]\s*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return { collector, generation, text, stepBudget, modelId, withImage };
  };

  const userTurn = history[history.length - 1];
  /** How much of the turn's budget is left. Never negative. */
  const msLeft = () => Math.max(0, TURN_BUDGET_MS - (Date.now() - startedAt));

  // The internal photograph note is a memory aid for the model, not something
  // the shopper wrote. Stripped once, so the success and failure log paths
  // cannot disagree about what was said.
  const loggedUserContent = userTurn.content.replace(
    /\n\[The customer attached a photograph here\.\]\s*$/,
    ""
  );

  /** Files the turn on the way out of a failure, then answers with the apology. */
  const bail = async () => {
    await logConciergeTurn(supabase, {
      sessionId,
      userContent: loggedUserContent,
      assistantContent: STUMBLED,
      signals: FAILED_SIGNALS,
      tappedIds,
      page,
      model: CONCIERGE_MODEL_ID,
      latencyMs: Date.now() - startedAt,
      hasImage: Boolean(image),
      photoReading: null,
      clientKey: key,
    });
    return fail(502, STUMBLED);
  };

  let turn: Awaited<ReturnType<typeof attempt>>;
  let photoDropped = false;
  try {
    turn = await attempt(Boolean(image));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Concierge generation failed:", message);

    // A turn the shopper saw fail is still a turn worth counting — it is the
    // single most useful row in the struggle list.
    if (!image) return bail();

    // The likeliest cause of a photograph turn throwing is a model that does
    // not accept images at all, which no amount of retrying fixes — but trying
    // once WITHOUT the picture does, and the shopper still typed a question
    // that deserves an answer.
    //
    // Only if there is genuinely room. A timeout means the budget is spent, and
    // so does any other late failure: starting a second call with seconds left
    // would outrun maxDuration, and a killed function loses the apology AND the
    // log row — strictly worse than answering honestly now.
    const timedOut = /abort|timeout/i.test(message);
    if (timedOut || msLeft() < MIN_RETRY_MS) return bail();

    try {
      turn = await attempt(false, true);
      photoDropped = true;
    } catch (retryErr) {
      console.error(
        "Concierge text-only retry failed:",
        retryErr instanceof Error ? retryErr.message : retryErr
      );
      return bail();
    }
  }

  const collector = turn.collector;
  let text = turn.text;
  const hadText = Boolean(text);

  // Say so, rather than quietly answering as though no picture had been sent.
  if (photoDropped || visionRefused) {
    text = `${PHOTO_UNAVAILABLE}\n\n${text}`.trim();
  }

  /**
   * A prefilled order reference is only honoured when the shopper actually
   * typed it. The model is asked not to invent one, but "asked not to" is not a
   * guarantee — and a reference the agent made up, sitting in a form the
   * shopper is about to submit with their own email, is a lookup attempt
   * against a stranger's order made to look like their own idea.
   */
  const resolvePrefill = (): string | undefined => {
    const raw = collector.stagedOrderLookup?.prefillOrderRef?.trim();
    if (!raw || !ORDER_REF_SHAPE.test(raw)) return undefined;
    const saidIt = history.some(
      (m) => m.role === "user" && m.content.toUpperCase().includes(raw.toUpperCase())
    );
    return saidIt ? raw : undefined;
  };

  const prefill = collector.stagedOrderLookup ? resolvePrefill() : undefined;

  const stage: ConciergeStage | null = collector.stagedOrderLookup
    ? {
        kind: "order_lookup",
        ...(prefill ? { prefillOrderRef: prefill } : {}),
      }
    : collector.stagedQuestion
      ? { kind: "question", question: collector.stagedQuestion }
      : collector.stagedIds.length > 0
        ? { kind: "products", products: resolveCards(collector.stagedIds, snapshot, collector.stockById) }
        : null;

  if (!text) {
    text =
      stage?.kind === "products"
        ? "Here is what I would show you."
        : stage?.kind === "question"
          ? "Tell me —"
          : stage?.kind === "order_lookup"
            ? "Let me pull that up — your order reference and the email you ordered with, just above."
            : STUMBLED;
  }

  // The model sometimes writes its quick replies as trailing prose lines
  // instead of calling suggest_replies. Salvage them: a run of two to four
  // short, unpunctuated final lines IS the chip set — written for this exact
  // moment, so more relevant than any fallback — and it comes out of the
  // visible text where it read as clutter.
  //
  // This runs BEFORE the exchange is filed, so the transcript records the reply
  // as the shopper actually read it. Filed first, every salvaged turn would be
  // stored with chip lines nobody ever saw in the conversation.
  if (
    collector.suggestions.length === 0 &&
    !collector.stagedQuestion &&
    !collector.stagedOrderLookup
  ) {
    const lines = text.split("\n").map((l) => l.trim());
    let cut = lines.length;
    const tail: string[] = [];
    for (let i = lines.length - 1; i >= 0 && tail.length < 4; i--) {
      const line = lines[i];
      if (!line) continue;
      if (line.length > 48 || /[.!]$/.test(line) || line.startsWith("[")) break;
      tail.unshift(line);
      cut = i;
    }
    if (tail.length >= 2 && cut > 0) {
      collector.suggestions = tail;
      const kept = lines.slice(0, cut);
      // A lead-in left orphaned above the chips ("Quick options:") goes too.
      while (kept.length > 0 && /^(quick (options|replies)|you (could|can) (ask|say|tap))\s*[:.]?$/i.test(kept[kept.length - 1] || "")) {
        kept.pop();
      }
      text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
  }

  // File the exchange — one call, so the user turn and its reply are ordered and
  // do not contend on the same session row. Failures cost the record, never the
  // reply. Everything the store learns from a conversation is decided here.
  await logConciergeTurn(supabase, {
    sessionId,
    userContent: loggedUserContent,
    assistantContent: text,
    // turn.withImage, not `image`: on the text-only retry the photograph was
    // dropped, so the turn that produced this reply never saw one.
    signals: readTurnSignals(turn.generation, collector, hadText, turn.withImage, turn.stepBudget),
    tappedIds,
    page,
    model: turn.modelId,
    latencyMs: Date.now() - startedAt,
    // The shopper did send a photograph, whether or not it could be read — the
    // insights tab counts what arrived, not what succeeded.
    hasImage: Boolean(image),
    photoReading: collector.photoReading,
    clientKey: key,
  });

  // A staged question or lookup form needs no chips — its own controls are the
  // interface. Anything beyond that, the widget decides: it knows what is on its
  // stage even when this turn staged nothing, so IT owns the contextual fallback.
  const suggestions =
    collector.stagedQuestion || collector.stagedOrderLookup ? [] : collector.suggestions;

  const response: ConciergeResponse = {
    ok: true,
    content: text,
    stage,
    suggestions,
    actions: collector.actions,
    ...(collector.offerCode ? { offerCode: collector.offerCode } : {}),
    ...(collector.photoReading ? { photoReading: collector.photoReading } : {}),
  };
  return NextResponse.json(response);
}
