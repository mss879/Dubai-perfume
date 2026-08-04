import "server-only";
import type { NextRequest } from "next/server";

/**
 * Entry guards for the public POST routes.
 *
 * `request.json()` buffers whatever the caller sends before the first line of
 * validation runs, so an unbounded body is enough to exhaust a function
 * instance. These helpers cap the read instead and hand back a result the
 * route can answer with, rather than throwing into the request path.
 */

/** Generous next to the largest legitimate body (a 50-line cart, ~8KB). */
export const MAX_BODY_BYTES = 64 * 1024;

export type JsonBodyResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: 400 | 413 };

export async function readJsonBody<T>(
  request: NextRequest,
  maxBytes: number = MAX_BODY_BYTES
): Promise<JsonBodyResult<T>> {
  // content-length is the client's own claim, so it only buys an early exit;
  // the streaming read below is what actually enforces the cap.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413 };
  }

  let raw: string | null;
  try {
    raw = await readCapped(request, maxBytes);
  } catch {
    return { ok: false, status: 400 };
  }
  if (raw === null) {
    return { ok: false, status: 413 };
  }

  try {
    return { ok: true, body: JSON.parse(raw) as T };
  } catch {
    return { ok: false, status: 400 };
  }
}

/** Reads the body, abandoning it the moment it passes the cap. Null when oversize. */
async function readCapped(request: NextRequest, maxBytes: number): Promise<string | null> {
  const stream = request.body;
  if (!stream) {
    // No stream exposed (an empty body, or a runtime that buffers for us):
    // measure after the fact, the header check above having bounded the honest case.
    const text = await request.text();
    return new TextEncoder().encode(text).length > maxBytes ? null : text;
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

/**
 * The "company" field is on every public form but hidden from people, so only
 * a form-filling bot ever supplies a value.
 */
export function isBot(honeypot: unknown): boolean {
  return typeof honeypot === "string" && honeypot.trim().length > 0;
}
