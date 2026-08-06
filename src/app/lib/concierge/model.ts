import "server-only";
import { openai } from "@ai-sdk/openai";

/**
 * The one place the language model is named. Swapping provider or tier is a
 * two-line change here and nowhere else.
 *
 * gpt-5.4-mini is the deliberate choice: the production fast tier, built for
 * chat and tool-calling agents, quick enough that a multi-step turn (question
 * → stock check → staging → reply) lands inside a few seconds. Reasoning
 * effort is pinned to "low" for the same reason — a concierge answering
 * "what suits a summer evening?" needs taste, not chain-of-thought, and every
 * saved second is felt in the chat window. (gpt-5.4 models accept
 * none|low|medium|high|xhigh; "low" keeps just enough planning for the
 * multi-step tool loop.)
 */

const MODEL_ID = process.env.CONCIERGE_MODEL || "gpt-5.4-mini";

/** Recorded against every turn, so a model change is visible in the insights. */
export const CONCIERGE_MODEL_ID = MODEL_ID;

/**
 * The model that reads photographs.
 *
 * Kept separate from the text model because whether the configured chat model
 * accepts image input is not something the code can know — it is a property of
 * whatever CONCIERGE_MODEL happens to be pointed at. Set CONCIERGE_VISION_MODEL
 * when the two need to differ; otherwise the same model handles both and, if it
 * turns out to be text-only, the route apologises and answers without the
 * picture rather than failing the turn.
 *
 * Set CONCIERGE_VISION=off to switch photograph reading off entirely.
 */
const VISION_MODEL_ID = process.env.CONCIERGE_VISION_MODEL || MODEL_ID;

/** Recorded against a photograph turn, so the two are distinguishable later. */
export const CONCIERGE_VISION_MODEL_ID = VISION_MODEL_ID;

export const isVisionEnabled =
  Boolean(process.env.OPENAI_API_KEY) &&
  (process.env.CONCIERGE_VISION || "").toLowerCase() !== "off";

export const isModelConfigured = Boolean(process.env.OPENAI_API_KEY);

export function getConciergeModel() {
  return openai(MODEL_ID);
}

export function getConciergeVisionModel() {
  return openai(VISION_MODEL_ID);
}

/** Passed as providerOptions on every generateText call. */
export const CONCIERGE_PROVIDER_OPTIONS = {
  openai: { reasoningEffort: "low" as const },
};
