/** How the concierge's replies ended, in the owner's words. `bad` ones are worth a look. */
export const OUTCOMES: Record<string, { label: string; note: string; bad: boolean }> = {
  answered: { label: "Answered", note: "A good reply", bad: false },
  no_match: { label: "Nothing to show", note: "Searched, but nothing in the shop matched", bad: true },
  no_tools: { label: "Talked only", note: "Answered without looking at the shop", bad: true },
  dead_end: { label: "Dead end", note: "Neither an answer nor anything to show", bad: true },
  bad_ids: { label: "Wrong products", note: "Named products that don't exist", bad: true },
  truncated: { label: "Cut off", note: "Ran out of room mid-reply", bad: true },
  failed: { label: "Failed", note: "The reply itself failed", bad: true },
  no_image_match: { label: "Photo not matched", note: "Read a photo, found nothing close", bad: true },
};

export function outcomeOf(key: string) {
  return OUTCOMES[key] ?? { label: key.replace(/_/g, " "), note: "", bad: true };
}

/** 0–23 in Dubai time as "9am" / "12pm". */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${h < 12 ? "am" : "pm"}`;
}

export const CONCIERGE_PAGE_SIZE = 25;
export const WINDOWS = [7, 30, 90] as const;
