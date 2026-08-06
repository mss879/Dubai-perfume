"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";

const HAIRLINE = "rgba(0,0,0,0.12)";

/**
 * The teaser card a closed concierge may raise beside its launcher — a flat
 * white card with one quiet line. Clicking the line opens the conversation;
 * the ✕ declines it (and useConciergeNudges silences that rule for a day).
 */
export default function ConciergeNudge({
  text,
  onAccept,
  onDismiss,
}: {
  text: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed bottom-[88px] right-6 z-[90] w-[260px] border bg-white"
      style={{ borderColor: HAIRLINE }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2.5 top-2.5 text-[#9a9a9a] transition-colors duration-300 hover:text-black cursor-pointer"
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.25} />
      </button>
      <button
        type="button"
        onClick={onAccept}
        className="block w-full px-4 py-4 pr-8 text-left cursor-pointer"
      >
        <span className="block text-[9px] font-normal uppercase tracking-[0.2em] text-[#646464]">
          The concierge
        </span>
        <span className="mt-1.5 block text-[12px] font-light leading-relaxed text-black">
          {text}
        </span>
      </button>
    </motion.div>
  );
}
