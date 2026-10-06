/**
 * Example photography for the demo catalog and the site's editorial slots.
 *
 *   npm run media:examples
 *
 * Photos are free-licence Unsplash images (https://unsplash.com/license),
 * listed with credits in scripts/example-media/photos.json. They are examples:
 * replace them with QUATTRO's own photography before launch.
 *
 * - "uploads" photos (products, categories, collections) are demo data and go
 *   to uploads/examples/, next to what the admin uploads.
 * - "public" photos (hero, story, About) ship with the app in public/images/site/.
 *
 * Idempotent: files that already exist are skipped, so it is cheap to re-run.
 * A network failure only warns — the site still works, showing the gaps.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { IMAGE_WIDTHS } from "../src/features/catalog/media";

type Photo = {
  name: string;
  target: "uploads" | "public";
  crop: "portrait" | "natural";
  id: string;
  raw: string;
  alt: string | null;
  credit: { name: string; url: string };
};

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "scripts", "example-media", "photos.json");
const uploads = () => path.resolve(process.env.UPLOADS_DIR ?? "uploads");

function outputBase(photo: Photo) {
  return photo.target === "uploads"
    ? path.join(uploads(), "examples", photo.name)
    : path.join(ROOT, "public", "images", "site", photo.name);
}

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

async function download(photo: Photo) {
  // Unsplash's image CDN resizes on request; 2000px is plenty for the 1600px variant.
  const url = `${photo.raw}&w=2000&q=85&fm=jpg&fit=max`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function processPhoto(photo: Photo, buffer: Buffer) {
  const base = outputBase(photo);
  await mkdir(path.dirname(base), { recursive: true });
  // Products share one 4:5 frame (like every admin upload); editorial keeps its own.
  const framed =
    photo.crop === "portrait"
      ? await sharp(buffer)
          .rotate()
          .resize(1600, 2000, { fit: "cover", position: "attention" })
          .toBuffer()
      : await sharp(buffer).rotate().toBuffer();
  await Promise.all(
    IMAGE_WIDTHS.map((width) =>
      sharp(framed)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(`${base}-${width}.webp`),
    ),
  );
}

export async function ensureExampleMedia({ quiet = false } = {}) {
  const photos = JSON.parse(await readFile(MANIFEST, "utf8")) as Photo[];
  let fetched = 0;
  let failed = 0;
  for (const photo of photos) {
    const base = outputBase(photo);
    const done = await Promise.all(IMAGE_WIDTHS.map((w) => exists(`${base}-${w}.webp`)));
    if (done.every(Boolean)) continue;
    try {
      await processPhoto(photo, await download(photo));
      fetched++;
      if (!quiet) console.log(`  ✓ ${photo.name}`);
    } catch (error) {
      failed++;
      console.warn(`  ! ${photo.name}: ${(error as Error).message}`);
    }
  }

  // Attribution isn't required by the Unsplash licence, but it's good practice.
  const credits = [
    "# Example photo credits",
    "",
    "Free-licence photos from [Unsplash](https://unsplash.com/license), used as examples",
    "until QUATTRO's own photography replaces them.",
    "",
    "| Used for | Photographer | Photo |",
    "| --- | --- | --- |",
    ...photos.map((p) => `| ${p.name} | ${p.credit.name} | [${p.id}](${p.credit.url}) |`),
    "",
  ].join("\n");
  await writeFile(path.join(ROOT, "scripts", "example-media", "CREDITS.md"), credits);

  if (fetched || failed) {
    console.log(
      `✓ example photos: ${fetched} added${failed ? `, ${failed} failed (offline? re-run npm run media:examples)` : ""}`,
    );
  }
}

// Run directly: `tsx scripts/example-media.ts`
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  await ensureExampleMedia();
}
