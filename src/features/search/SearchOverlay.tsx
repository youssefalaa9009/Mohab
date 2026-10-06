import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { Price } from "@/features/catalog/components/Price";
import type { CategorySummary } from "@/features/catalog/types";
import { cn } from "@/lib/cn";
import type { SearchResults } from "./types";
import { clearRecent, readRecent, rememberSearch } from "./recent";

const DEBOUNCE_MS = 200;

/**
 * Full-width search panel from the top. Suggestions arrive as you type
 * (debounced, previous request cancelled); Enter goes to the full results page.
 */
export function SearchOverlay({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategorySummary[];
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  // Recent searches are read while open rather than on an "open" event: this
  // dialog is opened from outside, and Base UI only reports its own triggers.
  const [, setCleared] = useState(0);
  const recent = open ? readRecent() : [];

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/catalog/search/suggest?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? (response.json() as Promise<SearchResults>) : null))
        .then((data) => {
          if (data) setResults(data);
          setLoading(false);
        })
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  /** Every way of closing starts the next search fresh. */
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
      setResults(null);
    }
    onOpenChange(next);
  };
  const close = () => handleOpenChange(false);
  const go = (value: string) => {
    rememberSearch(value);
    close();
    navigate(`/search?q=${encodeURIComponent(value)}`);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (term.length >= 2) go(term);
  };

  const showSuggestions = term.length >= 2 && results !== null && results.query.trim() === term;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 min-h-dvh bg-ink/30 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute" />
        <Dialog.Popup
          initialFocus={inputRef}
          className="fixed inset-x-0 top-0 max-h-dvh overflow-y-auto bg-canvas text-ink transition-transform duration-500 ease-[var(--ease-drawer)] outline-none data-ending-style:-translate-y-full data-starting-style:-translate-y-full motion-reduce:transition-none"
        >
          <Dialog.Title className="sr-only">Search the shop</Dialog.Title>
          <div className="container-page py-6 lg:py-10">
            <form
              onSubmit={submit}
              method="get"
              action="/search"
              role="search"
              className="flex items-center gap-3 border-b border-ink pb-3"
            >
              <Search aria-hidden className="size-5 shrink-0" />
              <label htmlFor="site-search" className="sr-only">
                Search products
              </label>
              <input
                ref={inputRef}
                id="site-search"
                name="q"
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Search products, colours, categories"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent font-display text-h2 placeholder:text-muted/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              <Dialog.Close
                aria-label="Close search"
                className="-me-2 inline-flex size-11 items-center justify-center"
              >
                <X aria-hidden className="size-5" />
              </Dialog.Close>
            </form>

            <div className="mt-8" aria-live="polite" aria-busy={loading}>
              {term.length < 2 ? (
                <div className="grid gap-10 md:grid-cols-2">
                  {recent.length > 0 && (
                    <section aria-labelledby="recent-heading">
                      <div className="flex items-center justify-between">
                        <h2 id="recent-heading" className="label-caps text-muted">
                          Recent searches
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            clearRecent();
                            setCleared((value) => value + 1);
                          }}
                          className="link-underline label-caps text-muted hover:text-ink"
                        >
                          Clear
                        </button>
                      </div>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {recent.map((item) => (
                          <li key={item}>
                            <button
                              type="button"
                              onClick={() => go(item)}
                              className="h-9 border border-line-strong px-3 text-small hover:border-ink"
                            >
                              {item}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {categories.length > 0 && (
                    <section aria-labelledby="browse-heading">
                      <h2 id="browse-heading" className="label-caps text-muted">
                        Browse
                      </h2>
                      <ul className="mt-4 flex flex-col">
                        {categories.map((category) => (
                          <li key={category.slug}>
                            <Link
                              to={`/shop/${category.slug}`}
                              onClick={close}
                              className="flex items-center justify-between border-b border-line py-3 font-display text-h3 hover:italic"
                            >
                              {category.name}
                              <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              ) : showSuggestions ? (
                results.products.length === 0 && results.categories.length === 0 ? (
                  <p className="text-muted">
                    No matches for “{term}”. Try a different word, or browse a category.
                  </p>
                ) : (
                  <div
                    className={cn(
                      "grid gap-10",
                      results.categories.length > 0 && "lg:grid-cols-[1fr_3fr]",
                    )}
                  >
                    {results.categories.length > 0 && (
                      <section aria-labelledby="cat-heading">
                        <h2 id="cat-heading" className="label-caps text-muted">
                          Categories
                        </h2>
                        <ul className="mt-4 flex flex-col gap-2">
                          {results.categories.map((category) => (
                            <li key={category.slug}>
                              <Link
                                to={`/shop/${category.slug}`}
                                onClick={close}
                                className="link-underline font-display text-h3"
                              >
                                {category.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    <section aria-labelledby="products-heading">
                      <div className="flex items-baseline justify-between gap-4">
                        <h2 id="products-heading" className="label-caps text-muted">
                          {results.total} {results.total === 1 ? "product" : "products"}
                        </h2>
                        <button
                          type="button"
                          onClick={() => go(term)}
                          className="link-underline label-caps"
                        >
                          See all results
                        </button>
                      </div>
                      <ul className="mt-4 grid grid-cols-2 gap-gutter sm:grid-cols-3 lg:grid-cols-6">
                        {results.products.map((product) => (
                          <li key={product.id}>
                            <Link
                              to={`/products/${product.slug}`}
                              onClick={() => {
                                rememberSearch(term);
                                close();
                              }}
                              className="group block"
                            >
                              <div className="aspect-[4/5] overflow-hidden">
                                <ProductImage
                                  image={product.primaryImage}
                                  decorative
                                  sizes="(min-width: 64rem) 16vw, 45vw"
                                />
                              </div>
                              <p className="mt-2 text-small group-hover:underline">
                                {product.name}
                              </p>
                              <Price
                                price={product.price}
                                compareAtPrice={product.compareAtPrice}
                                className="text-caption"
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                )
              ) : (
                <p className="text-small text-muted">Searching…</p>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
