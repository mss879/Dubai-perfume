import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, isSupabaseConfigured } from "../../lib/supabase-server";
import { isMissingFunction, MIGRATIONS_PENDING_MESSAGE } from "../../lib/rpc-errors";

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
