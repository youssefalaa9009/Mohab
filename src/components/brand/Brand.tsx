import { cn } from "@/lib/cn";

/**
 * The logo (slide 6 of the brand deck), as a CSS mask over `currentColor`, so
 * it takes the text colour of wherever it sits: bone on the dark site, ink on
 * a light card. Size it by height; the width follows the artwork.
 * Decorative by default — the surrounding link or heading carries the name.
 */
export function Logo({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block logo-mark", className)} />;
}

/** The deck's four-point sparkle — "quattro" is four. Purely decorative. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("size-4 fill-current", className)}>
      <path d="M12 0C12.7 7.3 16.7 11.3 24 12 16.7 12.7 12.7 16.7 12 24 11.3 16.7 7.3 12.7 0 12 7.3 11.3 11.3 7.3 12 0Z" />
    </svg>
  );
}
