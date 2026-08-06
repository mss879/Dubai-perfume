"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type {
  ConciergeAction,
  ConciergeOrderView,
  ConciergeStage,
} from "../../lib/concierge/types";
import StageProductExhibit from "./StageProductExhibit";
import StageQuestion from "./StageQuestion";
import StageOrderLookup from "./StageOrderLookup";

/**
 * The agent's stage — the top zone of the concierge window, where products
 * are exhibited and scent-builder questions appear as tiles. Exhibits
 * crossfade; nothing slides, bounces, or glows. When there is nothing to
 * show, the maison shows its name, the way an empty vitrine still carries
 * the monogram.
 */

function stageKey(stage: ConciergeStage | null): string {
  if (!stage) return "welcome";
  if (stage.kind === "question") return `q:${stage.question.id}:${stage.question.prompt}`;
  // One key for the lookup whatever it is showing. The form and the timeline it
  // becomes are the same exhibit; keying them apart would remount the pane
  // mid-lookup and put this crossfade in a fight with the one inside it.
  if (stage.kind === "order_lookup") return "order";
  return `p:${stage.products.map((p) => p.id).join("-")}`;
}

export default function ConciergeStageView({
  stage,
  busy,
  orderView,
  onAdd,
  onAnswer,
  onLookupOrder,
  onResetOrder,
}: {
  stage: ConciergeStage | null;
  busy: boolean;
  /** A looked-up order, when the lookup form has produced one. */
  orderView?: ConciergeOrderView | null;
  onAdd: (product: ConciergeAction["product"], size: string) => void;
  onAnswer: (text: string) => void;
  onLookupOrder?: (orderRef: string, email: string) => Promise<void>;
  onResetOrder?: () => void;
}) {
  const reduced = useReducedMotion();
  const fade = reduced
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3, ease: "easeOut" as const },
      };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f5f5f5]">
      <AnimatePresence mode="wait">
        <motion.div key={stageKey(stage)} className="h-full w-full" {...fade}>
          {!stage && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <span className="maison-eyebrow">Gharib</span>
              <p className="font-display text-[22px] leading-none tracking-[0.1em] uppercase text-black">
                The Concierge
              </p>
              <p className="max-w-[300px] text-[12px] font-light leading-relaxed text-[#646464]">
                Six houses of Gulf perfumery, and someone who knows every bottle on the shelf.
              </p>
            </div>
          )}
          {stage?.kind === "products" && (
            <StageProductExhibit products={stage.products} onAdd={onAdd} />
          )}
          {stage?.kind === "question" && (
            <StageQuestion question={stage.question} disabled={busy} onAnswer={onAnswer} />
          )}
          {stage?.kind === "order_lookup" && onLookupOrder && onResetOrder && (
            <StageOrderLookup
              prefillOrderRef={stage.prefillOrderRef}
              order={orderView}
              busy={busy}
              onLookup={onLookupOrder}
              onReset={onResetOrder}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
