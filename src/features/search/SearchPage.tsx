import { Search } from "lucide-react";
import { useEffect } from "react";
import { Form, Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { ProductGrid } from "@/features/catalog/components/ProductCard";
import { apiGet } from "@/lib/api";
import { Meta } from "@/lib/seo";
import { useRootData } from "@/root";
import { rememberSearch } from "./recent";
import type { SearchResults } from "./types";

export async function searchLoader(args: LoaderFunctionArgs) {
  const q = new URL(args.request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2)
    return { query: q, products: [], categories: [], total: 0 } satisfies SearchResults;
  return apiGet<SearchResults>(args, `/api/catalog/search?q=${encodeURIComponent(q)}`);
}

export function SearchPage() {
  const results = useLoaderData() as SearchResults;
  const { nav } = useRootData();
  const term = results.query;

  useEffect(() => {
    if (term) rememberSearch(term);
  }, [term]);

  return (
    <main id="main" className="container-page flex-1 pt-10 pb-section lg:pt-14">
      <Meta title={term ? `Search: ${term}` : "Search"} noindex />

      <Form
        method="get"
        role="search"
        className="flex max-w-2xl items-center gap-3 border-b border-ink pb-3"
      >
        <Search aria-hidden className="size-5 shrink-0" />
        <label htmlFor="search-page-q" className="sr-only">
          Search products
        </label>
        <input
          id="search-page-q"
          name="q"
          type="search"
          defaultValue={term}
          placeholder="Search products, colours, categories"
          className="min-w-0 flex-1 bg-transparent font-display text-h2 placeholder:text-muted/50 focus:outline-none"
        />
      </Form>

      {term.length >= 2 && (
        <p className="mt-6 label-caps text-muted" aria-live="polite">
          {results.total} {results.total === 1 ? "result" : "results"} for “{term}”
        </p>
      )}

      {results.categories.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {results.categories.map((category) => (
            <li key={category.slug}>
              <Link
                to={`/shop/${category.slug}`}
                className="inline-flex h-9 items-center border border-ink px-4 label-caps hover:bg-ink hover:text-paper"
              >
                All {category.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {results.products.length > 0 ? (
        <ProductGrid products={results.products} className="mt-10" />
      ) : term.length >= 2 ? (
        <div className="mt-12 border border-line px-6 py-16 text-center">
          <p className="font-display text-h2">Nothing found</p>
          <p className="mt-3 text-muted">
            Check the spelling, try a broader word, or browse a category.
          </p>
          {nav && nav.categories.length > 0 && (
            <ul className="mt-8 flex flex-wrap justify-center gap-2">
              {nav.categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    to={`/shop/${category.slug}`}
                    className="inline-flex h-9 items-center border border-line-strong px-4 text-small hover:border-ink"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </main>
  );
}
