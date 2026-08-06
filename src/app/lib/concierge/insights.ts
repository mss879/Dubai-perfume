import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingFunction } from "../rpc-errors";
import { STEP_BUDGET, type ConciergeCollector } from "./tools";

/**
 * What the store learns from a conversation.
 *
 * The transcript alone says what was said. This says what HAPPENED: which
 * bottles were put in front of someone and which of those left with them, what
 * the agent searched for and came back empty-handed from, and whether the reply
 * was actually any good. All of it is read off the turn that just finished —
 * nothing here asks the model to grade itself.
 *
 * The write is one RPC (migration 54's log_concierge_turn), which replaced the
 * two racing log_concierge_message calls: they contended on the same session
 * row and left the user turn and its reply unorderable.
 */

/**
 * How a turn ended. The SAME eight values are whitelisted by the CHECK on
 * concierge_messages.outcome and coerced in log_concierge_turn — change one and
 * you must change all of them, or rows start arriving with the outcome silently
 * dropped to NULL.
 */
export type ConciergeOutcome =
  | "answered"
  | "no_match"
  | "no_tools"
  | "dead_end"
  | "bad_ids"
  | "truncated"
  | "failed"
  | "no_image_match";

/**
 * The shape this module needs out of generateText's result.
 *
 * Structural rather than the SDK's generic GenerateTextResult: nothing here
 * cares which tools were in the set, and naming the generic would drag the
 * whole ToolSet through every signature for no benefit.
 */
export type TurnGeneration = {
  finishReason: string;
  usage: { inputTokens?: number; outputTokens?: number };
  steps: ReadonlyArray<{
    finishReason: string;
    toolCalls: ReadonlyArray<{ toolName: string; input: unknown }>;
    toolResults: ReadonlyArray<{ toolName: string; output: unknown }>;
  }>;
};

export type TurnSignals = {
  outcome: ConciergeOutcome;
  toolsUsed: string[];
  searchTerms: string[];
  addedIds: number[];
  shownIds: number[];
  questionId: string | null;
  inputTokens: number;
  outputTokens: number;
};

/** What is recorded when the model call itself threw. */
export const FAILED_SIGNALS: TurnSignals = {
  outcome: "failed",
  toolsUsed: [],
  searchTerms: [],
  addedIds: [],
  shownIds: [],
  questionId: null,
  inputTokens: 0,
  outputTokens: 0,
};

function readSearchQuery(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const q = (input as { query?: unknown }).query;
  return typeof q === "string" && q.trim() ? q.trim() : null;
}

/** A search_products result that found nothing. */
function foundNothing(output: unknown): boolean {
  if (!output || typeof output !== "object") return false;
  const total = (output as { totalMatches?: unknown }).totalMatches;
  return typeof total === "number" && total === 0;
}

/**
 * Read the turn.
 *
 * The outcome chain is ordered most-specific first, and every rung is something
 * the owner could act on: `no_match` is a gap in the catalogue, `bad_ids` is the
 * agent hallucinating, `truncated` is the step budget being too tight, and
 * `dead_end` is a reply that gave the shopper nothing at all.
 */
export function readTurnSignals(
  generation: TurnGeneration,
  collector: ConciergeCollector,
  hadText: boolean,
  hasImage: boolean,
  /** The step cap this turn actually ran under — a retry runs under a smaller one. */
  stepBudget: number
): TurnSignals {
  const toolsUsed: string[] = [];
  const searchTerms: string[] = [];
  let emptySearch = false;
  let calledShow = false;

  for (const step of generation.steps ?? []) {
    for (const call of step.toolCalls ?? []) {
      toolsUsed.push(call.toolName);
      if (call.toolName === "show_products") calledShow = true;
      if (call.toolName === "search_products") {
        const q = readSearchQuery(call.input);
        if (q) searchTerms.push(q);
      }
    }
    for (const result of step.toolResults ?? []) {
      if (result.toolName === "search_products" && foundNothing(result.output)) {
        emptySearch = true;
      }
    }
  }

  const staged =
    collector.stagedIds.length > 0 ||
    Boolean(collector.stagedQuestion) ||
    Boolean(collector.stagedOrderLookup);

  // It asked for products by id and not one of them existed. show_products drops
  // unknown ids silently — by design, so a hallucination reaches nobody — which
  // is exactly why it has to be counted here or it would leave no trace at all.
  //
  // Compared against `staged`, not against stagedIds alone: a turn may legally
  // show products and then claim the stage with a question or a lookup form,
  // which clears stagedIds and would otherwise read as a hallucination.
  const phantomIds = calledShow && !staged;

  const steps = generation.steps?.length ?? 0;

  const outcome: ConciergeOutcome =
    generation.finishReason === "length"
      ? "truncated"
      : // stepCountIs(n) stops on steps.length === n, so a step count at the
        // budget is ambiguous on its own — a turn that simply finished on its
        // last allowed step looks identical. Only a step that ended still
        // wanting to call a tool was genuinely cut off.
        generation.finishReason === "tool-calls" && steps >= stepBudget
        ? "truncated"
        : phantomIds
          ? "bad_ids"
          : hasImage && collector.photoReading && !staged && emptySearch
            ? "no_image_match"
            : emptySearch && !staged
              ? "no_match"
              : toolsUsed.length === 0
                ? "no_tools"
                : !hadText && !staged
                  ? "dead_end"
                  : "answered";

  return {
    outcome,
    toolsUsed,
    searchTerms,
    addedIds: collector.actions.map((a) => a.product.id),
    shownIds: collector.stagedIds,
    questionId: collector.stagedQuestion?.id ?? null,
    inputTokens: Math.max(0, Math.round(generation.usage?.inputTokens ?? 0)),
    outputTokens: Math.max(0, Math.round(generation.usage?.outputTokens ?? 0)),
  };
}

export type TurnLogInput = {
  sessionId: string;
  userContent: string;
  assistantContent: string;
  signals: TurnSignals;
  tappedIds: number[];
  page: string | null;
  model: string;
  latencyMs: number;
  hasImage: boolean;
  photoReading: string | null;
  clientKey: string;
};

let warnedMissingLog = false;

/**
 * File the turn. Best-effort by design — a shopper must never see an error
 * because their conversation could not be recorded.
 *
 * Note the function on the other end swallows its own exceptions too, so a
 * clean return here does NOT prove a row was written. That is what the smoke
 * test in migration 54's operations note is for.
 */
export async function logConciergeTurn(
  supabase: SupabaseClient,
  input: TurnLogInput
): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_concierge_turn", {
      p_session_id: input.sessionId,
      p_user_content: input.userContent,
      p_assistant_content: input.assistantContent,
      p_outcome: input.signals.outcome,
      p_shown_product_ids: input.signals.shownIds.length ? input.signals.shownIds : null,
      p_added_product_ids: input.signals.addedIds.length ? input.signals.addedIds : null,
      p_tapped_product_ids: input.tappedIds.length ? input.tappedIds : null,
      p_question_id: input.signals.questionId,
      p_tools_used: input.signals.toolsUsed.length ? input.signals.toolsUsed : null,
      p_search_terms: input.signals.searchTerms.length ? input.signals.searchTerms : null,
      p_page: input.page,
      p_model: input.model,
      p_latency_ms: input.latencyMs,
      p_input_tokens: input.signals.inputTokens,
      p_output_tokens: input.signals.outputTokens,
      p_has_image: input.hasImage,
      p_photo_reading: input.photoReading,
      p_client_key: input.clientKey,
    });
    if (error && isMissingFunction(error) && !warnedMissingLog) {
      warnedMissingLog = true;
      console.error(
        "log_concierge_turn is missing — apply migration 54. Conversations are not being recorded."
      );
    }
  } catch {
    // Logging is best-effort by design.
  }
}
