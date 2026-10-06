import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigation, useNavigationType } from "react-router";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Glide to an element; it lands below the sticky header via `scroll-margin-top`. */
function glideTo(hash: string, smooth: boolean) {
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return false;
  target.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "start" });
  return true;
}

/**
 * Scrolling between pages, the way a visitor expects it:
 *  - a new page glides to the top (from far down, it jumps most of the way first);
 *  - a link to a section (`/about#story`) shows the page arriving at the top,
 *    then glides down to that section;
 *  - back/forward return to exactly where you were;
 *  - query-only changes (shop filters, pagination) leave the scroll alone.
 * Reduced motion: every move is instant.
 */
export function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const lastY = useRef(0);
  const previous = useRef<{ pathname: string; first: boolean }>({
    pathname: location.pathname,
    first: true,
  });

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const onScroll = () => {
      lastY.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Remember where each history entry was left (read before the next page renders).
  useEffect(() => {
    const key = location.key;
    const saved = positions.current;
    return () => {
      saved.set(key, lastY.current);
    };
  }, [location.key]);

  useEffect(() => {
    const smooth = !reducedMotion();
    const samePage = previous.current.pathname === location.pathname;
    const first = previous.current.first;
    previous.current = { pathname: location.pathname, first: false };

    if (first) {
      // A shared link to a section: let the page settle, then glide there.
      if (location.hash) {
        const timer = window.setTimeout(() => glideTo(location.hash, smooth), 400);
        return () => window.clearTimeout(timer);
      }
      return;
    }

    if (navigationType === "POP") {
      window.scrollTo({ top: positions.current.get(location.key) ?? 0, behavior: "instant" });
      return;
    }

    if (location.hash) {
      if (samePage) {
        glideTo(location.hash, smooth);
        return;
      }
      // Arrive at the top, give the page a beat to fade in, then glide down.
      window.scrollTo({ top: 0, behavior: "instant" });
      const timer = window.setTimeout(() => glideTo(location.hash, smooth), smooth ? 450 : 0);
      return () => window.clearTimeout(timer);
    }

    if (samePage) return;
    // From deep down a long page, skip most of the way so the glide stays short.
    if (window.scrollY > window.innerHeight * 1.5) {
      window.scrollTo({ top: window.innerHeight * 0.6, behavior: "instant" });
    }
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "instant" });
  }, [location.key, location.pathname, location.hash, navigationType]);

  return null;
}

/** A page slower than this shows skeletons; quicker ones just swap, with no flash. */
const SKELETON_DELAY_MS = 200;

/**
 * Wraps each page: a newly navigated-to page fades up into place, and while a
 * new page's data is loading, a thin progress line runs along the top and —
 * if it takes a moment — skeletons in the shape of that page stand in for it.
 * The very first page is left alone: it's server-rendered and paints at once.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigation = useNavigation();
  // The key of the page the visitor landed on; anything later is a navigation.
  const [landingKey] = useState(location.key);
  const animate = location.key !== landingKey;

  // Only a move to a different page counts; filter and sort changes keep their page.
  const pending =
    navigation.state === "loading" && navigation.location.pathname !== location.pathname
      ? navigation.location
      : null;
  const [skeletonFor, setSkeletonFor] = useState<string | null>(null);
  const pendingKey = pending?.key ?? null;
  useEffect(() => {
    if (!pendingKey) return;
    const timer = window.setTimeout(() => setSkeletonFor(pendingKey), SKELETON_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pendingKey]);

  return (
    <>
      {navigation.state !== "idle" && (
        <div
          role="progressbar"
          aria-label="Loading page"
          className="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
        >
          <div className="h-full w-1/3 animate-indeterminate bg-linear-to-r from-transparent via-bone to-transparent" />
        </div>
      )}
      {pending && skeletonFor === pending.key ? (
        <PageSkeleton pathname={pending.pathname} />
      ) : (
        <div
          key={location.pathname}
          className={cn("flex flex-1 flex-col", animate && "animate-page-in")}
        >
          {children}
        </div>
      )}
    </>
  );
}
