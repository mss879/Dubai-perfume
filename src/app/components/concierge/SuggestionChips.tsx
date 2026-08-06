"use client";

/**
 * Quick replies under the latest assistant message. Deliberately quieter than
 * the ADD buttons in the exhibit above — a chip is a whisper of a next step,
 * not a call to action, so it gets a grey fill and no border rather than the
 * outline vocabulary the buy buttons own.
 */
export default function SuggestionChips({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: string[];
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-3.5">
      {suggestions.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onPick(text)}
          className="bg-[#f5f5f5] px-3 py-2 text-[10px] font-normal uppercase tracking-[0.12em] text-[#3a3a3a] transition-colors duration-300 hover:bg-black hover:text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
