import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Round "back to top" button that fades in once the visitor is well down a
 * page. Its ring fills with reading progress. Hidden (and out of the tab
 * order) until needed.
 */
export function BackToTop() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
      setVisible(window.scrollY > window.innerHeight * 1.2);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const circumference = 2 * Math.PI * 22;
  return (
    <button
      type="button"
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={visible ? undefined : true}
      onClick={() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
      }}
      className={cn(
        "group fixed end-4 bottom-4 z-40 inline-flex size-12 items-center justify-center rounded-full bg-surface/80 text-ink backdrop-blur-md transition-[opacity,translate] duration-500 ease-[var(--ease-out-expo)] md:end-6 md:bottom-6",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <svg aria-hidden viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90">
        <circle cx="24" cy="24" r="22" fill="none" className="stroke-line" strokeWidth="1.5" />
        <circle
          cx="24"
          cy="24"
          r="22"
          fill="none"
          className="stroke-ink"
          strokeWidth="1.5"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <ArrowUp
        aria-hidden
        className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5"
      />
    </button>
  );
}
