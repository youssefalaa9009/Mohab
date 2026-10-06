import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { IMAGE_WIDTHS } from "../../src/features/catalog/media.js";

/**
 * Product photography lives on the server's disk (a Docker volume in
 * production) and is served from /media with immutable caching; Cloudflare
 * caches it at the edge. Swappable for object storage later without changing
 * keys: only this module knows where files are.
 */
export const uploadsDir = () => path.resolve(process.env.UPLOADS_DIR ?? "uploads");

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);
/** Refuse decompression bombs: a 20 MB file can still describe a billion pixels. */
const MAX_INPUT_PIXELS = 50_000_000;

export class MediaError extends Error {}

export type StoredImage = { key: string; width: number; height: number };

/**
 * Validate an upload by decoding it (never trusting the declared type), fix
 * its orientation, and write one WebP per display width.
 */
export async function storeProductImage(buffer: Buffer): Promise<StoredImage> {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new MediaError("That file isn’t an image we can read.");
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw new MediaError("Upload a JPEG, PNG, WebP or AVIF image.");
  }

  // EXIF orientations 5–8 are rotated 90°: width and height swap once applied.
  const rotated = (metadata.orientation ?? 1) >= 5;
  const width = (rotated ? metadata.height : metadata.width) ?? 0;
  const height = (rotated ? metadata.width : metadata.height) ?? 0;
  if (width < 400 || height < 400) {
    throw new MediaError("Images must be at least 400 × 400 pixels.");
  }

  const key = `products/${randomUUID()}`;
  const directory = path.join(uploadsDir(), "products");
  await mkdir(directory, { recursive: true });

  await Promise.all(
    IMAGE_WIDTHS.map((target) =>
      sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(uploadsDir(), `${key}-${target}.webp`)),
    ),
  );

  return { key, width, height };
}

export async function deleteStoredImage(key: string) {
  // Placeholder keys never had files.
  if (!key.startsWith("products/")) return;
  await Promise.all(
    IMAGE_WIDTHS.map((target) =>
      unlink(path.join(uploadsDir(), `${key}-${target}.webp`)).catch(() => {}),
    ),
  );
}
