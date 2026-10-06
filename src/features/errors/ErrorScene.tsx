import { ArrowLeft, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useRouteLoaderData } from "react-router";
import { Sparkle } from "@/components/brand/Brand";
import { buttonClassName } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/useHydrated";
import type { RootData } from "@/root";

type Copy = { eyebrow: string; title: string; message: string };

/** What went missing decides the wording: a removed product reads differently from a typo. */
function copyFor(status: number, pathname: string): Copy {
  if (status !== 404) {
    return {
      eyebrow: `Error ${status}`,
      title: "Something went wrong",
      message: "We couldn’t load this page. It’s on our side — please try again in a moment.",
    };
  }
  if (pathname.startsWith("/products/")) {
    return {
      eyebrow: "No longer available",
      title: "This piece has moved on",
      message:
        "It may have sold out or been removed from the collection. Here’s where to find what’s new.",
    };
  }
  if (pathname.startsWith("/collections/") || pathname.startsWith("/shop/")) {
    return {
      eyebrow: "Not found",
      title: "This edit isn’t here",
      message: "The collection or category may have been renamed or removed.",
    };
  }
  return {
    eyebrow: "Page not found",
    title: "Lost in the stars",
    message:
      "This page may have been moved, renamed or removed — or the link has a typo. Try a search, or start from one of these.",
  };
}

/**
 * The shared error page: big numerals with the brand's sparkle standing in
 * for the zero, a search box and shortcuts. Server-rendered and usable before
 * hydration (the search is a plain GET form).
 */
export function ErrorScene({ status, action }: { status: number; action?: ReactNode }) {
  const { pathname } = useLocation();
  const hydrated = useHydrated();
  const root = useRouteLoaderData("root") as RootData | undefined;
  const categories = root?.nav?.categories ?? [];
  const copy = copyFor(status, pathname);
  const digits = String(status).split("");

  return (
    <main
      id="main"
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-gutter py-section text-center"
    >
      <title>{`${copy.title} · QUATTRO`}</title>
      <meta name="robots" content="noindex" />

      {/* Drifting sparkles behind */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Sparkle className="absolute top-[18%] left-[12%] size-4 animate-twinkle text-bone" />
        <Sparkle className="absolute top-[30%] right-[16%] size-6 animate-twinkle text-bone [animation-delay:-1.5s]" />
        <Sparkle className="absolute bottom-[22%] left-[22%] size-3 animate-twinkle text-bone [animation-delay:-3s]" />
        <Sparkle className="absolute right-[26%] bottom-[16%] size-5 animate-twinkle text-bone [animation-delay:-2.2s]" />
      </div>

      <p
        aria-hidden
        className="relative flex items-center font-display text-[clamp(7rem,24vw,16rem)] leading-none"
      >
        {digits.map((digit, index) =>
          digit === "0" ? (
            <Sparkle
              key={index}
              className="mx-[0.04em] size-[0.72em] animate-spin-slow text-silver [animation-duration:18s]"
            />
          ) : (
            <span
              key={index}
              className="animate-fade-up"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              {digit}
            </span>
          ),
        )}
      </p>

      <p className="relative mt-6 label-caps text-muted">{copy.eyebrow}</p>
      <h1 className="relative mt-3 font-display text-h1">{copy.title}</h1>
      <p className="relative mt-4 max-w-[48ch] text-muted">{copy.message}</p>

      {status === 404 ? (
        <>
          <form
            action="/search"
            method="get"
            role="search"
            className="relative mt-10 flex w-full max-w-md items-center border-b border-line-strong focus-within:border-ink"
          >
            <label htmlFor="error-search" className="sr-only">
              Search products
            </label>
            <Search aria-hidden className="size-4 text-muted" />
            <input
              id="error-search"
              name="q"
              type="search"
              placeholder="Search tees, hoodies, trousers…"
              className="h-12 flex-1 bg-transparent px-3 placeholder:text-muted/70 focus:outline-none"
            />
            <button type="submit" className="label-caps">
              Search
            </button>
          </form>

          <ul className="relative mt-8 flex flex-wrap justify-center gap-2">
            {[
              { label: "New arrivals", to: "/new-arrivals" },
              ...categories.map((category) => ({
                label: category.name,
                to: `/shop/${category.slug}`,
              })),
            ].map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-small transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="relative mt-10 flex flex-wrap justify-center gap-3">
        {action}
        {hydrated && window.history.length > 1 && (
          <button
            type="button"
            onClick={() => window.history.back()}
            className={buttonClassName({ variant: "ghost", className: "gap-2" })}
          >
            <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
            Go back
          </button>
        )}
        <Link to="/" className={buttonClassName({ variant: "secondary" })}>
          Home
        </Link>
      </div>
    </main>
  );
}
