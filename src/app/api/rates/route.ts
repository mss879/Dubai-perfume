import { NextResponse } from "next/server";
import { FALLBACK_RATES } from "../../lib/currency-shared";

/**
 * AED-base display rates, fetched server-side and cached for 12 hours.
 * Replaces the per-visitor browser calls to open.er-api.com (and the two
 * divergent hardcoded tables that shipped alongside them).
 */
export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/AED", {
      next: { revalidate: 43200 },
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.result === "success" && json.rates) {
        const rates: Record<string, number> = {};
        for (const code of Object.keys(FALLBACK_RATES)) {
          if (typeof json.rates[code] === "number") rates[code] = json.rates[code];
        }
        return NextResponse.json({ rates, source: "live" });
      }
    }
  } catch {
    // fall through to the static table
  }
  return NextResponse.json({ rates: FALLBACK_RATES, source: "fallback" });
}
