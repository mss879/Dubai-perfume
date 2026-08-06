"use client";

import { useState } from "react";
import type { StageQuestion as StageQuestionPayload } from "../../lib/concierge/types";

const HAIRLINE = "rgba(0,0,0,0.12)";

/**
 * A scent-builder question as tappable tiles. A tap answers in the shopper's
 * own transcript voice — the option label is sent as their message — so the
 * conversation reads naturally and the server never needs a second protocol.
 * Multi-select gathers labels behind a confirm.
 */
export default function StageQuestion({
  question,
  disabled,
  onAnswer,
}: {
  question: StageQuestionPayload;
  disabled: boolean;
  onAnswer: (text: string) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const tap = (label: string) => {
    if (disabled) return;
    if (!question.allowMultiple) {
      onAnswer(label);
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const confirm = () => {
    if (picked.size === 0 || disabled) return;
    onAnswer([...picked].join(", "));
    setPicked(new Set());
  };

  return (
    <div className="flex h-full flex-col justify-center gap-4 px-6 py-5">
      <div>
        <span className="maison-eyebrow block">Scent builder</span>
        <p className="font-display mt-2 text-[17px] leading-[1.3] tracking-[0.04em] uppercase text-black">
          {question.prompt}
        </p>
      </div>

      <div className={`grid gap-2 ${question.options.length > 4 ? "grid-cols-3" : "grid-cols-2"}`}>
        {question.options.map((option) => {
          const selected = picked.has(option.label);
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => tap(option.label)}
              className={`border px-3 py-2.5 text-left transition-colors duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                selected ? "border-black bg-black text-white" : "bg-white text-black hover:border-black"
              }`}
              style={selected ? undefined : { borderColor: HAIRLINE }}
            >
              <span className="block text-[11px] font-normal uppercase tracking-[0.1em]">
                {option.label}
              </span>
              {option.hint && (
                <span
                  className={`mt-0.5 block text-[10px] font-light leading-snug ${selected ? "text-white/70" : "text-[#646464]"}`}
                >
                  {option.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {question.allowMultiple && (
        <button
          type="button"
          disabled={picked.size === 0 || disabled}
          onClick={confirm}
          className="maison-btn self-start cursor-pointer"
          style={{ padding: "10px 20px", fontSize: 10 }}
        >
          That&apos;s me
        </button>
      )}
    </div>
  );
}
