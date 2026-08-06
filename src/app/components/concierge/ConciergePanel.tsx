"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, ChevronDown, ChevronUp, RotateCcw, X } from "lucide-react";
import { prepareImage, UnreadableImageError } from "./prepareImage";
import type {
  ConciergeAction,
  ConciergeOrderView,
  ConciergePreparedImage,
  ConciergeStage,
} from "../../lib/concierge/types";
import type { ChatMessage, ChatStatus } from "./useConciergeChat";
import ConciergeStageView from "./ConciergeStage";
import SuggestionChips from "./SuggestionChips";

const HAIRLINE = "rgba(0,0,0,0.12)";

/**
 * The concierge window — the CartDrawer pattern grown a second zone. The top
 * is the agent's stage (exhibits and scent-builder questions); the bottom is
 * the conversation and the input. The stage can be folded away when the
 * shopper wants the whole height for reading.
 *
 * Sits at z-[94]/[95], deliberately UNDER the cart drawer's z-[100]: when the
 * concierge adds to the bag, the bag slides in over the conversation — the
 * store's own choreography for "it worked".
 */

/** Same exhibit? Compared by content — object identity dies in localStorage. */
function sameStage(a: ConciergeStage | null | undefined, b: ConciergeStage | null): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "products" && b.kind === "products") {
    return a.products.map((p) => p.id).join(",") === b.products.map((p) => p.id).join(",");
  }
  if (a.kind === "question" && b.kind === "question") {
    return a.question.id === b.question.id && a.question.prompt === b.question.prompt;
  }
  // There is only ever one lookup form, so two of them are always the same one.
  if (a.kind === "order_lookup" && b.kind === "order_lookup") return true;
  return false;
}

function TypingIndicator() {
  const reduced = useReducedMotion();
  return (
    <div className="flex items-center gap-2 pt-1" aria-label="The concierge is composing">
      <span className="text-[11px] font-normal uppercase tracking-[0.16em] text-[#646464]">
        The concierge is composing
      </span>
      <span className="flex gap-[3px]">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="text-[14px] leading-none text-[#646464]"
            animate={reduced ? undefined : { opacity: [0.25, 1, 0.25] }}
            transition={reduced ? undefined : { duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          >
            ·
          </motion.span>
        ))}
      </span>
    </div>
  );
}

export default function ConciergePanel({
  open,
  onClose,
  messages,
  stage,
  status,
  notice,
  orderView,
  onSend,
  onRetry,
  onStartOver,
  onAdd,
  onRestoreStage,
  onLookupOrder,
  onResetOrder,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  stage: ConciergeStage | null;
  status: ChatStatus;
  notice: string | null;
  /** A looked-up order, when the lookup form has produced one. */
  orderView?: ConciergeOrderView | null;
  onSend: (text: string, image?: ConciergePreparedImage | null) => void;
  onRetry: () => void;
  onStartOver: () => void;
  onAdd: (product: ConciergeAction["product"], size: string) => void;
  onRestoreStage: (stage: ConciergeStage) => void;
  onLookupOrder?: (orderRef: string, email: string) => Promise<void>;
  onResetOrder?: () => void;
}) {
  const [input, setInput] = useState("");
  const [stageFolded, setStageFolded] = useState(false);
  const [attachment, setAttachment] = useState<ConciergePreparedImage | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Downscale in the browser before anything is sent. A phone camera produces
   * several megabytes; the route accepts half of one.
   */
  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setAttachError(null);
    setPreparing(true);
    try {
      setAttachment(await prepareImage(file));
    } catch (err) {
      setAttachment(null);
      setAttachError(
        err instanceof UnreadableImageError
          ? err.message
          : "That photograph could not be prepared."
      );
    } finally {
      setPreparing(false);
      // Cleared so choosing the same file twice still fires a change event.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /**
   * Give the window focus when it opens — once per opening, and never again.
   *
   * This used to sit in the Escape effect above, which lists `onClose`. The
   * parent hands down a fresh arrow for that on every render, and the pages
   * mounting the concierge re-render constantly — the homepage's typing search
   * placeholder alone re-renders twenty times a second. So the effect re-ran at
   * that rate, and every run pulled focus back onto the panel, off whatever the
   * shopper had just clicked. The input could not be typed in at all.
   */
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Follow the conversation down as it grows.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length, status]);

  const submit = () => {
    const text = input.trim();
    // A photograph is a message on its own — "do you have this?" is implied.
    if ((!text && !attachment) || status === "sending" || preparing) return;
    setInput("");
    setAttachment(null);
    setAttachError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend(text, attachment);
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[94] cursor-pointer"
            aria-hidden="true"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white border-l z-[95] flex flex-col font-body text-black outline-none"
            style={{ borderColor: HAIRLINE }}
            role="dialog"
            aria-modal="true"
            aria-label="Perfume concierge"
            tabIndex={-1}
            ref={panelRef}
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div
              className="flex items-center justify-between gap-4 px-5 py-4 border-b"
              style={{ borderColor: HAIRLINE }}
            >
              <div>
                <span className="block text-[9px] font-normal uppercase tracking-[0.2em] text-[#646464]">
                  Gharib
                </span>
                <h3 className="font-display mt-0.5 text-[18px] leading-none tracking-[0.07em] uppercase text-black">
                  The Concierge
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onStartOver}
                  aria-label="Start the conversation over"
                  title="Start over"
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-[#646464] transition-colors duration-300 hover:text-black cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" strokeWidth={1.25} />
                  Start over
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close the concierge"
                  className="text-black transition-opacity duration-300 hover:opacity-60 cursor-pointer"
                >
                  <X className="w-[18px] h-[18px]" strokeWidth={1.25} />
                </button>
              </div>
            </div>

            {/* ── The stage ──────────────────────────────────────────── */}
            {!stageFolded && (
              <div
                className="relative h-[38%] min-h-[220px] shrink-0 border-b"
                style={{ borderColor: HAIRLINE }}
              >
                <ConciergeStageView
                  stage={stage}
                  busy={status === "sending"}
                  orderView={orderView}
                  onAdd={onAdd}
                  onAnswer={onSend}
                  onLookupOrder={onLookupOrder}
                  onResetOrder={onResetOrder}
                />
                <button
                  type="button"
                  onClick={() => setStageFolded(true)}
                  aria-label="Fold the display away"
                  className="absolute right-3 top-3 text-[#646464] transition-colors duration-300 hover:text-black cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" strokeWidth={1.25} />
                </button>
              </div>
            )}
            {stageFolded && (
              <button
                type="button"
                onClick={() => setStageFolded(false)}
                className="flex shrink-0 items-center justify-between border-b bg-[#f8f8f8] px-5 py-2.5 cursor-pointer"
                style={{ borderColor: HAIRLINE }}
              >
                <span className="text-[10px] font-normal uppercase tracking-[0.16em] text-[#646464]">
                  The display
                </span>
                <ChevronDown className="w-4 h-4 text-[#646464]" strokeWidth={1.25} />
              </button>
            )}

            {/* ── The conversation ───────────────────────────────────── */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-5"
              aria-live="polite"
            >
              <div className="flex flex-col gap-5">
                {messages.map((message, index) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex flex-col items-end gap-2 self-end max-w-[85%]">
                      {message.thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={message.thumb}
                          alt="The photograph you sent"
                          className="h-[84px] w-auto border"
                          style={{ borderColor: HAIRLINE }}
                        />
                      )}
                      {message.content && (
                        <div className="bg-black px-4 py-3 text-[13px] font-light leading-relaxed text-white whitespace-pre-wrap">
                          {message.content}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      key={message.id}
                      className={index > 0 ? "border-t pt-5" : undefined}
                      style={index > 0 ? { borderColor: HAIRLINE } : undefined}
                    >
                      {message.content.split(/\n{2,}/).map((paragraph, i) => (
                        <p
                          key={i}
                          className={`text-[14px] font-light leading-[1.8] text-black whitespace-pre-wrap ${i > 0 ? "mt-3" : ""}`}
                        >
                          {paragraph}
                        </p>
                      ))}

                      {message.stage?.kind === "products" &&
                        message.stage.products.length > 0 &&
                        !sameStage(message.stage, stage) && (
                          <button
                            type="button"
                            onClick={() => onRestoreStage(message.stage!)}
                            title={message.stage.products.map((p) => p.name).join(" · ")}
                            aria-label={`Show again: ${message.stage.products.map((p) => p.name).join(", ")}`}
                            className="group mt-3 flex items-center gap-2 cursor-pointer"
                          >
                            {message.stage.products.map((p) => (
                              <span key={p.id} className="relative block h-9 w-9 bg-[#f5f5f5]">
                                <Image
                                  src={p.image}
                                  alt=""
                                  fill
                                  sizes="36px"
                                  className="object-contain p-1"
                                />
                              </span>
                            ))}
                            <span className="text-[9px] font-normal uppercase tracking-[0.16em] text-[#9a9a9a] transition-colors duration-300 group-hover:text-black">
                              Show again
                            </span>
                          </button>
                        )}

                      {message.failed && (
                        <button
                          type="button"
                          onClick={onRetry}
                          className="mt-3 border px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-[#646464] transition-colors duration-300 hover:border-black hover:text-black cursor-pointer"
                          style={{ borderColor: HAIRLINE }}
                        >
                          Try again
                        </button>
                      )}

                      {message === lastAssistant && !message.failed && status !== "sending" && (
                        <SuggestionChips
                          suggestions={message.suggestions ?? []}
                          disabled={status !== "idle"}
                          onPick={onSend}
                        />
                      )}
                    </div>
                  )
                )}
                {status === "sending" && <TypingIndicator />}
              </div>
            </div>

            {/* ── Notice + input ─────────────────────────────────────── */}
            {notice && (
              <div className="bg-black px-5 py-2.5 text-center text-[11px] font-normal uppercase tracking-[0.1em] text-white">
                {notice}
              </div>
            )}
            {/* What is about to be sent, and a way to change your mind. */}
            {(attachment || attachError || preparing) && (
              <div
                className="flex items-center gap-3 border-t px-5 py-3"
                style={{ borderColor: HAIRLINE }}
              >
                {attachment && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.thumb}
                    alt=""
                    className="h-12 w-12 border object-cover"
                    style={{ borderColor: HAIRLINE }}
                  />
                )}
                <span className="flex-1 text-[11px] font-light leading-relaxed text-[#646464]">
                  {preparing
                    ? "Preparing the photograph…"
                    : attachError
                      ? attachError
                      : "Ready to send. Add a word about it, or just send."}
                </span>
                {(attachment || attachError) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttachment(null);
                      setAttachError(null);
                    }}
                    aria-label="Remove the photograph"
                    className="text-[#646464] transition-colors duration-300 hover:text-black cursor-pointer"
                  >
                    <X className="w-4 h-4" strokeWidth={1.25} />
                  </button>
                )}
              </div>
            )}

            <div
              className="flex items-end gap-3 border-t px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]"
              style={{ borderColor: HAIRLINE }}
            >
              {/* On a phone this opens the camera; on a desktop, the file
                  picker — which is what a saved Instagram screenshot needs. */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={status === "sending" || preparing}
                aria-label="Send a photograph of a bottle"
                title="Photograph a bottle"
                className="mb-0.5 text-[#646464] transition-colors duration-300 hover:text-black disabled:opacity-40 cursor-pointer"
              >
                <Camera className="w-[18px] h-[18px]" strokeWidth={1.25} />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder={attachment ? "Say something about it…" : "Ask about a fragrance…"}
                aria-label="Message the concierge"
                className="min-h-[24px] flex-1 resize-none bg-transparent text-[14px] font-light leading-relaxed text-black outline-none placeholder:text-[#757575]"
              />
              <button
                type="button"
                onClick={submit}
                disabled={(!input.trim() && !attachment) || status === "sending" || preparing}
                className="maison-btn cursor-pointer"
                style={{ padding: "11px 20px", fontSize: 11 }}
              >
                Send
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
