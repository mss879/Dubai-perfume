import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getAdminIdentity, type AdminIdentity } from "./auth";
import { isSameOrigin, readJsonBody } from "./request-guard";
import { SITE_URL } from "./site";
import { isSupabaseConfigured } from "./supabase-server";

/**
 * The gate every admin write route shares: a verified admin, calling from this
 * site's own pages. Reads and writes then go through the admin's own session,
 * so row-level security has the last word.
 */

export function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

type Gate = { ok: true; admin: AdminIdentity } | { ok: false; response: NextResponse };

export async function guardAdminWrite(request: NextRequest): Promise<Gate> {
  if (!isSupabaseConfigured) return { ok: false, response: reply(503, { error: "Store database is not configured." }) };
  const admin = await getAdminIdentity();
  if (!admin || !isSameOrigin(request, SITE_URL)) return { ok: false, response: reply(403, { error: "Not authorised." }) };
  return { ok: true, admin };
}

type Body = { ok: true; body: unknown } | { ok: false; response: NextResponse };

/** A JSON body, capped in size (bytes). */
export async function readAdminJson(request: NextRequest, maxBytes = 16 * 1024): Promise<Body> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { ok: false, response: reply(415, { error: "Invalid request." }) };
  }
  const parsed = await readJsonBody<unknown>(request, maxBytes);
  if (!parsed.ok) return { ok: false, response: reply(parsed.status, { error: "Invalid request." }) };
  return { ok: true, body: parsed.body };
}

/** Postgres's "duplicate key" (a code or id that already exists). */
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
