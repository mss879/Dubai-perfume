"use client";

import type { ConciergePreparedImage } from "../../lib/concierge/types";

/**
 * Get a photograph small enough to send, in the browser.
 *
 * The arithmetic that sets the target: base64 costs 4/3 of the bytes it
 * encodes, the route accepts a 512KB body, and the request also carries a
 * transcript. So the image must land under about 400,000 base64 characters —
 * roughly 300KB of JPEG. A modern phone camera produces 3-6MB, so downscaling
 * is not an optimisation here, it is the difference between working and a 413.
 *
 * Nothing is uploaded. The bytes go inline with one request, are read once, and
 * are gone; the thumbnail below never leaves the browser at all.
 */

/** The route's own ceiling on the encoded string. Keep the two in step. */
const MAX_BASE64 = 400_000;

/**
 * Tried in order until one fits, largest first. A single descending ladder
 * rather than a grid of sizes and qualities: each rung is strictly smaller than
 * the one before, so the first that fits is also the best that fits.
 */
const LADDER: [number, number][] = [
  [896, 0.72],
  [896, 0.6],
  [768, 0.6],
  [640, 0.55],
  [512, 0.5],
];

/** A photograph that could not be prepared, and why — the message differs. */
export class UnreadableImageError extends Error {
  reason: "codec" | "not-image" | "too-large" | "encode";
  constructor(reason: UnreadableImageError["reason"], message: string) {
    super(message);
    this.name = "UnreadableImageError";
    this.reason = reason;
  }
}

/** Refused before any decoding: a 40MB file is not worth trying to shrink. */
const MAX_SOURCE_BYTES = 24 * 1024 * 1024;

function drawTo(bitmap: ImageBitmap, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UnreadableImageError("encode", "This device could not process the photograph.");
  // A bottle shot against a dark bar top loses its edges on a transparent
  // canvas re-encoded as JPEG; white is what a photograph is normally on.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBase64(canvas: HTMLCanvasElement, quality: number): string {
  const url = canvas.toDataURL("image/jpeg", quality);
  const comma = url.indexOf(",");
  return comma >= 0 ? url.slice(comma + 1) : "";
}

export async function prepareImage(file: File): Promise<ConciergePreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new UnreadableImageError("not-image", "That is not an image — a photograph, please.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new UnreadableImageError("too-large", "That photograph is too large to send.");
  }

  let bitmap: ImageBitmap;
  try {
    // imageOrientation: "from-image" applies the EXIF rotation. Without it,
    // photographs taken on a phone held normally arrive on their side — iOS
    // stores them landscape with a rotation flag rather than rotating the pixels.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Overwhelmingly this is HEIC, which iOS uses by default and canvas cannot
    // decode. The camera path converts to JPEG on the way out, so this is
    // almost always a picture chosen from the library instead.
    throw new UnreadableImageError(
      "codec",
      "This photograph is in a format the browser cannot open. A screenshot of it will work."
    );
  }

  try {
    for (const [edge, quality] of LADDER) {
      const canvas = drawTo(bitmap, edge);
      const data = toBase64(canvas, quality);
      if (!data) continue;
      if (data.length <= MAX_BASE64) {
        // A separate, much smaller encode for the transcript bubble. Kept apart
        // from what is sent so the preview cannot quietly bloat localStorage.
        const thumb = drawTo(bitmap, 240).toDataURL("image/jpeg", 0.5);
        return { image: { mediaType: "image/jpeg", data }, thumb };
      }
    }
  } finally {
    bitmap.close();
  }

  throw new UnreadableImageError("too-large", "That photograph is too large to send.");
}
