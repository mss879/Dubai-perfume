"use client";

import { getBrowserSupabase } from "../../lib/supabase-browser";

const MAX_SIDE = 2000;
const MAX_BYTES = 15 * 1024 * 1024;
/** Uploaded as they are when the browser can't re-encode them (migration 68 holds the buckets to these). */
const SHOWABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;

/** Re-encodes a photo as WebP, scaled down to at most 2000px on its long side. */
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no blob"))), "image/webp", 0.85);
  });
}

type Upload = { ok: true; url: string } | { ok: false; error: string };

/** Uploads one picture to one of the store's own buckets; returns its public link. */
export async function uploadImage(file: File, bucket: "product-images" | "collection-covers", folder: string): Promise<Upload> {
  if (!file.type.startsWith("image/")) return { ok: false, error: `${file.name} isn't an image.` };
  if (file.size > MAX_BYTES) return { ok: false, error: `${file.name} is larger than 15 MB.` };

  let body: Blob = file;
  let extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  let contentType = file.type;
  try {
    body = await toWebp(file);
    extension = "webp";
    contentType = "image/webp";
  } catch {
    // The browser couldn't convert it. Upload the original only if every
    // browser can show it (not HEIC, SVG or TIFF), and only if it's small
    // enough for the shop's pages.
    if (!SHOWABLE.has(file.type)) {
      return { ok: false, error: `${file.name} can't be shown in the shop. Save it as a JPEG or PNG and try again.` };
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      return { ok: false, error: `${file.name} couldn't be resized. Use a picture under 5 MB.` };
    }
  }

  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const storage = getBrowserSupabase().storage.from(bucket);
  const { error } = await storage.upload(path, body, { contentType, upsert: false });
  if (error) return { ok: false, error: `${file.name}: ${error.message}` };
  const { data } = storage.getPublicUrl(path);
  return data?.publicUrl ? { ok: true, url: data.publicUrl } : { ok: false, error: `${file.name}: no public link.` };
}

/** A product photo, in the product-images bucket. */
export function uploadProductImage(file: File): Promise<Upload> {
  return uploadImage(file, "product-images", "products");
}

/** A collection's cover picture, in the collection-covers bucket. */
export function uploadCollectionCover(file: File): Promise<Upload> {
  return uploadImage(file, "collection-covers", "covers");
}
