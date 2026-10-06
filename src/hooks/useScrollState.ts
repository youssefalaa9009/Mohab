import { useEffect, useState } from "react";

export type ScrollState = {
  /** Scrolled past the threshold — the header turns solid. */
  scrolled: boolean;
  /** Scrolling down past the threshold — the header hides. */
  hidden: boolean;
};

/**
 * Tracks scroll direction for the header.
 *
 * The listener is passive and only calls setState when a boolean actually
 * flips, so scrolling does not re-render the tree on every frame.
 */
export function useScrollState(threshold = 24): ScrollState {
  const [state, setState] = useState<ScrollState>({ scrolled: false, hidden: false });

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const read = () => {
      frame = 0;
      const y = window.scrollY;
      const scrolled = y > threshold;
      // Ignore small jitters and never hide the header near the top of the page.
      const delta = y - lastY;
      const hidden = y > threshold * 4 && delta > 4 ? true : delta < -4 ? false : undefined;
      lastY = y;

      setState((prev) => {
        const next = { scrolled, hidden: hidden ?? prev.hidden };
        return next.scrolled === prev.scrolled && next.hidden === prev.hidden ? prev : next;
      });
    };

    const onScroll = () => {
      // Coalesce bursts of scroll events into one read per frame.
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return state;
}
