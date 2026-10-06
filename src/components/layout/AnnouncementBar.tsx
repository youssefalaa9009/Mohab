import { Sparkle } from "@/components/brand/Brand";
import { site } from "@/config/site";

/** Each half of the track repeats the messages this many times, so it outruns wide screens. */
const REPEAT = 3;

/**
 * The bar above the header, as an endless ticker. Screen readers get the
 * messages once, as plain text; the moving copies are decorative. It pauses
 * on hover, and stands still for visitors who prefer reduced motion.
 */
export function AnnouncementBar() {
  const messages = site.announcements;
  if (!messages.length) return null;
  const run = Array.from({ length: REPEAT }, () => messages).flat();

  return (
    <div
      data-surface="dark"
      className="group relative flex h-9 items-center overflow-hidden border-b border-line bg-night text-bone"
    >
      <p className="sr-only">{messages.join(". ")}</p>
      <div
        aria-hidden
        className="flex w-max animate-marquee [--marquee-duration:55s] group-hover:[animation-play-state:paused]"
      >
        {[0, 1].map((half) => (
          <ul key={half} className="flex shrink-0 items-center">
            {run.map((message, index) => (
              <li key={index} className="flex items-center gap-6 px-6 label-caps whitespace-nowrap">
                <Sparkle className="size-2.5 text-silver" />
                {message}
              </li>
            ))}
          </ul>
        ))}
      </div>
      {/* Soft edges, so messages slide in and out of the dark rather than off a cliff. */}
      <div className="pointer-events-none absolute inset-y-0 start-0 w-16 bg-linear-to-r from-night to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 end-0 w-16 bg-linear-to-l from-night to-transparent" />
    </div>
  );
}
