import { cn } from "@/lib/cn";
import { imageSrcSet, imageUrl } from "../media";
import { useRootData } from "@/root";
import type { ImageRef } from "../types";

const PLACEHOLDER_PREFIX = "placeholder:";
const TONES = ["bg-stone-1", "bg-stone-2", "bg-stone-3", "bg-stone-4"];
const DARK_TONES = new Set([2, 3]);

type ProductImageProps = {
  image: ImageRef | null;
  className?: string;
  /** Empty alt for images whose meaning is already in adjacent text (product cards). */
  decorative?: boolean;
  /** Above-the-fold images load eagerly with high priority; everything else lazily. */
  priority?: boolean;
  sizes?: string;
  /** CSS object-position: keeps the subject in frame when the box crops the photo. */
  focus?: string;
};

/**
 * A product photo, or a clearly labelled stand-in while QUATTRO's photography
 * does not exist yet. Uploads are stored in three widths, so the browser picks
 * the smallest file that fills the slot (`sizes` says how wide the slot is).
 */
export function ProductImage({
  image,
  className,
  decorative = false,
  priority = false,
  sizes = "(min-width: 64rem) 25vw, 50vw",
  focus,
}: ProductImageProps) {
  const { mediaUrl } = useRootData();

  if (!image || image.key.startsWith(PLACEHOLDER_PREFIX) || !mediaUrl) {
    const tone = Number(image?.key.slice(PLACEHOLDER_PREFIX.length)) || 0;
    const dark = DARK_TONES.has(tone % TONES.length);
    return (
      <div
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : (image?.alt ?? "Image placeholder")}
        aria-hidden={decorative || undefined}
        className={cn(
          // A size container: the monogram and caption scale with the image box,
          // from a 56px checkout thumbnail to a full-width hero panel.
          "@container relative flex h-full w-full flex-col items-center justify-center",
          TONES[tone % TONES.length],
          dark ? "text-paper/40" : "text-ink/25",
          className,
        )}
      >
        <span aria-hidden className="font-display text-[min(30cqi,5rem)] leading-none">
          Q
        </span>
        {/*
          Centred under the monogram: clear of badges and the wishlist heart in the
          corners, the site header over a hero, and text overlaid along the bottom.
        */}
        <span
          aria-hidden
          className={cn(
            "mt-3 hidden label-caps @min-[10rem]:block",
            // The caption is real text, so it meets 4.5:1; only the monogram is faint.
            dark ? "text-paper" : "text-ink",
          )}
        >
          Image placeholder
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl(mediaUrl, image.key)}
      srcSet={imageSrcSet(mediaUrl, image.key)}
      alt={decorative ? "" : image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
      style={focus ? { objectPosition: focus } : undefined}
    />
  );
}
