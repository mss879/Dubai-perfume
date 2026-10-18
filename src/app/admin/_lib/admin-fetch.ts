/**
 * The admin's one way of calling its own API from the browser. Never throws:
 * a failure comes back as a sentence the owner can read.
 */

export type AdminResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; field?: string };

export async function adminFetch<T = Record<string, unknown>>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  fallback = "That didn't work. Try again."
): Promise<AdminResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string; field?: string }) | null;
    if (!response.ok || !json || json.ok === false) {
      return {
        ok: false,
        status: response.status,
        error: json?.error || fallback,
        ...(typeof json?.field === "string" ? { field: json.field } : {}),
      };
    }
    return { ok: true, data: json };
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach the server. Check your connection and try again." };
  }
}
