import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { isMissingFunction, MIGRATIONS_PENDING_MESSAGE } from "../../lib/rpc-errors";
import { checkRateLimit, clientKey } from "../../lib/rate-limit";

/**
 * Guest order tracking: requires both the order number and the order email
 * (order_tracking is owner-scoped after migration 39).
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Tracking unavailable." }, { status: 503 });
  }

  const orderId = request.nextUrl.searchParams.get("order")?.trim();
  const email = request.nextUrl.searchParams.get("email")?.trim();
  if (!orderId || !email) {
    return NextResponse.json({ error: "Order number and email are required." }, { status: 422 });
  }

  const supabase = createServerSupabase();

  // Order references are sequential (order_number_seq, migration 40), so this
  // endpoint is an oracle for pairing a guessed reference with an address. It
  // had no limit at all. This is not a complete fix — track_guest_order is
  // granted to anon and can be called directly with the public key — but it
  // closes the unauthenticated HTTP path, which is the one people find.
  if (!(await checkRateLimit(supabase, `track:ip:${clientKey(request)}`, 15, 900))) {
    return NextResponse.json(
      { error: "Too many lookups just now. Please try again in a few minutes." },
      { status: 429 }
    );
  }

  const { data, error } = await supabase.rpc("track_guest_order", {
    p_order_id: orderId,
    p_email: email,
  });

  if (error) {
    if (isMissingFunction(error)) {
      console.error("track_guest_order is missing — apply migrations 38–42.");
      return NextResponse.json({ error: MIGRATIONS_PENDING_MESSAGE }, { status: 503 });
    }
    console.error("Guest order tracking failed:", error.message);
    return NextResponse.json({ error: "Tracking unavailable." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "No order found for that order number and email." },
      { status: 404 }
    );
  }
  return NextResponse.json(data);
}
