import { useEffect, useState } from "react";
import { Sparkle } from "@/components/brand/Brand";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";

/* ─── Starfield ─────────────────────────────────────────────────────────── */

/** Tiny seeded PRNG: the same sky on the server and in the browser (no hydration drift). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; size: number; delay: number; duration: number };

/** Three depth layers: far stars are small and barely move, near ones drift more. */
const LAYERS = (() => {
  const random = seeded(4);
  const round = (n: number) => Math.round(n * 100) / 100;
  return [
    { depth: 6, count: 34, min: 4, max: 7 },
    { depth: 16, count: 18, min: 7, max: 12 },
    { depth: 32, count: 7, min: 12, max: 20 },
  ].map((layer) => ({
    depth: layer.depth,
    stars: Array.from({ length: layer.count }, (): Star => ({
      x: round(random() * 100),
      y: round(random() * 100),
      size: round(layer.min + random() * (layer.max - layer.min)),
      delay: round(random() * -6),
      duration: round(3 + random() * 4),
    })),
  }));
})();

/** The four arms of the constellation: where each line ends, and where its label sits. */
const ARMS = [
  {
    end: [50, 2],
    label:
      "bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 text-center md:bottom-[calc(100%+0.75rem)]",
  },
  {
    // Phones: set vertically along the right edge, where a long word has no room to lie flat.
    end: [98, 50],
    label:
      "top-1/2 left-[calc(100%+0.25rem)] -translate-y-1/2 text-start [writing-mode:vertical-rl] md:left-[calc(100%+1.25rem)] md:[writing-mode:horizontal-tb]",
  },
  {
    end: [50, 98],
    label:
      "top-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 text-center md:top-[calc(100%+0.75rem)]",
  },
  {
    // Phones: vertical on the left, reading upwards.
    end: [2, 50],
    label:
      "top-1/2 right-[calc(100%+0.25rem)] -translate-y-1/2 rotate-180 text-start [writing-mode:vertical-rl] md:right-[calc(100%+1.25rem)] md:rotate-0 md:text-end md:[writing-mode:horizontal-tb]",
  },
] as const;

const CYCLE_MS = 3500;

/**
 * "Four energies, one identity": the brand's four values as a constellation
 * around its star. Hover, focus or tap an energy to light its arm and read its
 * line; left alone, it cycles through them. Behind it, a starfield drifts with
 * the pointer (parallax through CSS variables, no re-renders).
 *
 * Plain buttons and a live caption for assistive tech; still for reduced motion.
 */
export function Constellation() {
  const energies = site.energies;
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(
      () => setActive((index) => (index + 1) % energies.length),
      CYCLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, held, energies.length]);

  const hold = {
    onPointerEnter: () => setHeld(true),
    onPointerLeave: () => setHeld(false),
    onFocus: () => setHeld(true),
    onBlur: () => setHeld(false),
  };
  const energy = energies[active]!;

  return (
    <section
      aria-labelledby="energies-heading"
      data-surface="dark"
      onPointerMove={(event) => {
        // Mouse only: a tap on a phone would otherwise leave everything shifted.
        if (event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const style = event.currentTarget.style;
        style.setProperty("--mx", (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
        style.setProperty("--my", (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
      }}
      className="relative overflow-hidden border-y border-line bg-night py-section text-bone"
    >
      {/* Starfield */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {LAYERS.map((layer) => (
          <div
            key={layer.depth}
            className="absolute inset-[-4%] transition-transform duration-[900ms] ease-out motion-reduce:transform-none"
            style={{
              transform: `translate3d(calc(var(--mx, 0) * ${-layer.depth}px), calc(var(--my, 0) * ${-layer.depth}px), 0)`,
            }}
          >
            {layer.stars.map((star, index) => (
              <span
                key={index}
                className="absolute animate-twinkle text-bone"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: star.size,
                  height: star.size,
                  animationDelay: `${star.delay}s`,
                  animationDuration: `${star.duration}s`,
                }}
              >
                <Sparkle className="size-full" />
              </span>
            ))}
          </div>
        ))}
        {/* The deck's light leak */}
        <div className="absolute top-1/2 left-1/2 size-[50rem] -translate-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.08),transparent_60%)]" />
      </div>

      <div className="relative container-page">
        <header className="text-center">
          <p className="flex items-center justify-center gap-2 label-caps text-bone/60">
            <Sparkle className="size-3 text-silver" />
            What we’re about
          </p>
          <h2 id="energies-heading" className="mt-5 font-display text-h1">
            Four energies. <em className="text-bone/55">One identity.</em>
          </h2>
        </header>

        {/* The constellation */}
        <div
          className="relative mx-auto mt-24 aspect-square w-full max-w-[12.5rem] md:mt-40 md:max-w-[20rem] lg:max-w-[24rem]"
          {...hold}
        >
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            className="absolute inset-0 size-full overflow-visible"
          >
            <circle
              cx="50"
              cy="50"
              r="34"
              fill="none"
              className="stroke-bone/20"
              strokeWidth="0.35"
              strokeDasharray="0.6 1.6"
            />
            {ARMS.map((arm, index) => (
              <line
                // A new key each time an arm lights up restarts its draw-in.
                key={index === active ? `on-${active}` : `off-${index}`}
                x1="50"
                y1="50"
                x2={arm.end[0]}
                y2={arm.end[1]}
                pathLength={100}
                strokeWidth={index === active ? 0.55 : 0.25}
                className={index === active ? "animate-draw stroke-bone" : "stroke-bone/20"}
              />
            ))}
          </svg>

          {/* Sparkles orbiting the ring */}
          <div
            aria-hidden
            className="absolute inset-[16%] animate-spin-slow [animation-duration:24s]"
          >
            <Sparkle className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 text-silver" />
            <Sparkle className="absolute bottom-[14%] -left-1 size-2 text-bone/70" />
          </div>
          <div
            aria-hidden
            className="absolute inset-[6%] animate-spin-slow [animation-direction:reverse] [animation-duration:38s]"
          >
            <Sparkle className="absolute top-[20%] -right-1 size-2.5 text-bone/60" />
          </div>

          {/* The star at the centre, leaning towards the pointer */}
          <div
            aria-hidden
            className="absolute inset-[27%] transition-transform duration-700 ease-out motion-reduce:transform-none"
            style={{
              transform: "translate3d(calc(var(--mx, 0) * 12px), calc(var(--my, 0) * 12px), 0)",
            }}
          >
            {/* Upright, so its four points aim at the four energies; it breathes rather than spins. */}
            <Sparkle className="size-full animate-breathe text-bone drop-shadow-[0_0_30px_rgb(255_255_255/0.35)]" />
            <span
              key={active}
              className="absolute inset-0 flex animate-fade-up items-center justify-center font-display text-h3 text-night tabular-nums"
            >
              0{active + 1}
            </span>
          </div>

          {/* Labels around the ring (tablet and up) */}
          {energies.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setActive(index)}
              onPointerEnter={() => setActive(index)}
              aria-pressed={index === active}
              className={cn(
                "absolute block p-1 whitespace-nowrap transition-colors duration-500",
                ARMS[index]!.label,
                index === active ? "text-bone" : "text-bone/40 hover:text-bone/80",
              )}
            >
              <span className="block text-caption tracking-[0.2em] opacity-70 md:label-caps">
                0{index + 1}
              </span>
              <span className="mt-1 block font-display text-[1.5rem] leading-none italic md:text-h2">
                {item.name}
              </span>
            </button>
          ))}
        </div>

        {/* The active energy's line */}
        <p aria-live="polite" className="mx-auto mt-24 max-w-[36ch] text-center md:mt-44">
          <span key={active} className="block animate-fade-up">
            <span className="sr-only">{energy.name}: </span>
            <span className="font-display text-h3 text-bone/85">{energy.line}</span>
          </span>
        </p>
      </div>
    </section>
  );
}

/* ─── Spinning badge (story section) ─────────────────────────────────────── */

/**
 * A ring of text spinning slowly around a sparkle, like a stamp on the
 * founders' photo. Decorative.
 */
export function SpinningBadge({ text, className }: { text: string; className?: string }) {
  return (
    <div aria-hidden className={cn("relative size-32 lg:size-40", className)}>
      <svg viewBox="0 0 100 100" className="size-full animate-spin-slow [animation-duration:22s]">
        <defs>
          <path id="badge-ring" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
        </defs>
        <text className="fill-current text-[8.4px] font-medium tracking-[0.32em] uppercase">
          <textPath href="#badge-ring">{text}</textPath>
        </text>
      </svg>
      <Sparkle className="absolute inset-0 m-auto size-7" />
    </div>
  );
}
