import { NextRequest, NextResponse } from "next/server";

/**
 * A referral link (Admin → Referral scheme): /r/LAYLA-7K2Q remembers the
 * friend's code for 30 days, so checkout can offer it, and shows what it's
 * worth. The code is checked again at every step; nothing here grants money.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code || "").trim().toUpperCase();
  const url = new URL(request.url);
  if (!/^[A-Z]{2,8}-[A-Z0-9]{4}$/.test(code)) {
    return NextResponse.redirect(new URL("/", url.origin));
  }
  const response = NextResponse.redirect(new URL(`/invite/${encodeURIComponent(code)}`, url.origin));
  response.cookies.set("gharib_ref", code, { maxAge: 30 * 24 * 3600, path: "/", sameSite: "lax", httpOnly: false, secure: url.protocol === "https:" });
  return response;
}
