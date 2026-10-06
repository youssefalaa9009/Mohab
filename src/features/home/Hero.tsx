import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Logo, Sparkle } from "@/components/brand/Brand";
import { buttonClassName } from "@/components/ui/Button";
import { site } from "@/config/site";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { cn } from "@/lib/cn";
import { setHeroWordmarkVisible } from "./hero-visibility";

/** Campaign imagery, set in config/site.ts. Four of them: "quattro" is four. */
const SLIDES = site.images.hero;
const SLIDE_MS = 4000;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Full-bleed campaign hero: one photograph at a time, crossfading with a slow
 * zoom, and four progress segments that double as controls.
 *
 * - Auto-advances every few seconds; holds while hovered or focused (so a
 *   visitor can always stop it), when the tab is hidden, and stays still for
 *   visitors who prefer reduced motion.
 * - The first slide is server-rendered as the active one, so nothing changes
 *   at hydration and the LCP image is in the HTML.
 */
export function Hero({ shopHref }: { shopHref: string }) {
  const [active, setActive] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const press = useRef<{ x: number; y: number } | null>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  // Hand the logo over to the header's once this one scrolls out of view.
  useEffect(() => {
    const element = logoRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setHeroWordmarkVisible(entry.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      setHeroWordmarkVisible(true);
    };
  }, []);

  // A hidden tab holds the show, so it doesn't race ahead in the background.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const running = !hidden && !pressed && !focused;
  const step = (delta: number) =>
    setActive((index) => (index + delta + SLIDES.length) % SLIDES.length);
  useEffect(() => {
    if (!running || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(
      () => setActive((index) => (index + 1) % SLIDES.length),
      SLIDE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, running]);

  return (
    <section
      data-surface="dark"
      aria-roledescription="carousel"
      aria-labelledby="hero-heading"
      // Press and hold anywhere on the photo to pause (like stories); let go to
      // resume. A sideways swipe or drag changes the photo. Links and buttons
      // keep their own behaviour.
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        press.current = { x: event.clientX, y: event.clientY };
        setPressed(true);
      }}
      onPointerUp={(event) => {
        const start = press.current;
        press.current = null;
        setPressed(false);
        if (!start) return;
        const dx = event.clientX - start.x;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(event.clientY - start.y)) {
          // Swipe left for the next photo (mirrored for right-to-left reading).
          const rtl = document.documentElement.dir === "rtl";
          step(dx < 0 !== rtl ? 1 : -1);
        }
      }}
      onPointerCancel={() => {
        press.current = null;
        setPressed(false);
      }}
      // Keyboard users: holds while focus is inside, so the controls don't move away.
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      // Slides up under the transparent header.
      className="relative -mt-header flex min-h-[calc(100svh-2.25rem)] touch-pan-y flex-col justify-end overflow-hidden bg-night text-bone select-none"
    >
      {/* Slides */}
      <div aria-hidden className="absolute inset-0">
        {SLIDES.map((image, index) => (
          <div
            key={image.key}
            className={cn(
              "absolute inset-0 transition-opacity duration-[1400ms] ease-[var(--ease-in-out-quart)]",
              index === active ? "opacity-100" : "opacity-0",
            )}
          >
            <div
              className={cn(
                "h-full w-full transition-transform duration-[9000ms] ease-out motion-reduce:transition-none",
                index === active ? "scale-100" : "scale-110",
              )}
            >
              <ProductImage
                image={image}
                decorative
                priority={index === 0}
                sizes="100vw"
                focus={image.focus}
              />
            </div>
          </div>
        ))}
        {/* Scrims: legible type over any photograph, and the deck's dark vignette. */}
        <div className="absolute inset-0 bg-linear-to-t from-night via-night/35 to-night/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(0_0_0/0.55))]" />
      </div>

      <Sparkle className="absolute start-[6%] top-[calc(var(--header-height)+2rem)] size-6 animate-spin-slow text-bone/80" />
      <Sparkle className="absolute end-[8%] top-[38%] size-4 animate-spin-slow text-bone/60 [animation-direction:reverse] max-md:hidden" />

      {/* Vertical caption along the edge, editorial-style */}
      <p
        aria-hidden
        className="absolute end-6 top-1/2 hidden origin-center translate-x-1/2 -translate-y-1/2 rotate-90 label-caps tracking-[0.4em] whitespace-nowrap text-bone/50 lg:block"
      >
        {site.manifesto.slice(0, 2).join(" · ")}
      </p>

      <div className="relative container-page pb-8 lg:pb-12">
        <div ref={logoRef} aria-hidden className="animate-fade-up [animation-delay:300ms]">
          <Logo className="h-[clamp(6.5rem,22vw,17rem)] drop-shadow-[0_0_50px_rgb(0_0_0/0.5)]" />
        </div>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[34rem] animate-fade-up [animation-delay:650ms]">
            <h1 id="hero-heading" className="font-display text-h2">
              {site.headline}
            </h1>
            <p className="mt-4 text-bone/80">{site.statement}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to={shopHref}
                className={buttonClassName({
                  className: "border-bone bg-bone text-night hover:bg-bone/85",
                })}
              >
                Shop the collection
              </Link>
              <Link
                to="/new-arrivals"
                className={buttonClassName({
                  variant: "secondary",
                  className: "border-bone text-bone hover:bg-bone hover:text-night",
                })}
              >
                New arrivals
              </Link>
            </div>
          </div>

          <p aria-hidden className="-mb-4 label-caps text-bone/50 lg:hidden">
            {pressed ? "Paused" : "Hold to pause · Swipe"}
          </p>
          {/* Controls: counter, four segments, and how to pause */}
          <div className="flex animate-fade-up items-center gap-4 [animation-delay:800ms] lg:min-w-[22rem]">
            <span
              aria-hidden
              className={cn(
                "hidden label-caps whitespace-nowrap text-bone/50 transition-opacity lg:inline",
                pressed && "text-bone",
              )}
            >
              {pressed ? "Paused" : "Hold to pause · Drag"}
            </span>
            <span className="font-display text-h3 tabular-nums" aria-hidden>
              {pad(active + 1)}
              <span className="text-bone/50"> / {pad(SLIDES.length)}</span>
            </span>
            <ol className="flex flex-1 gap-2" aria-label="Choose a photograph">
              {SLIDES.map((image, index) => (
                <li key={image.key} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setActive(index)}
                    aria-label={`Photograph ${index + 1} of ${SLIDES.length}`}
                    aria-current={index === active ? "true" : undefined}
                    className="group/seg block w-full py-3"
                  >
                    <span className="relative block h-0.5 overflow-hidden bg-bone/25 transition-colors group-hover/seg:bg-bone/45">
                      {index < active && <span className="absolute inset-0 bg-bone" />}
                      {index === active && (
                        <span
                          // Restarts with each slide; freezes in place while paused.
                          key={active}
                          className="absolute inset-0 animate-fill bg-bone"
                          style={{
                            ["--slide-duration" as string]: `${SLIDE_MS}ms`,
                            animationPlayState: running ? "running" : "paused",
                          }}
                        />
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
