import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigation,
  useSearchParams,
  type LoaderFunctionArgs,
} from "react-router";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { apiGet, toQuery } from "@/lib/api";
import { cn } from "@/lib/cn";
import { JsonLd, Meta, breadcrumbJsonLd } from "@/lib/seo";
import { useRootData } from "@/root";
import { ProductGrid } from "../components/ProductCard";
import { SORT_OPTIONS, type ProductListResponse, type SortValue } from "../types";
import { ActiveFilters, FilterPanel } from "./Filters";
import {
  clearRefinements,
  hasRefinements,
  parseShopState,
  setParam,
  type ShopState,
} from "./shop-params";

export type ShopKind = "all" | "category" | "men" | "women" | "new" | "collection";

type ShopData = {
  kind: ShopKind;
  title: string;
  description: string | null;
  crumbs: Crumb[];
  list: ProductListResponse;
  state: ShopState;
  defaultSort: SortValue;
};

const SHOP_CRUMB: Crumb = { label: "Shop", to: "/shop" };
const HOME_CRUMB: Crumb = { label: "Home", to: "/" };

/** One loader factory for every listing route; each fixes a different scope. */
export function shopLoader(kind: ShopKind) {
  return async (args: LoaderFunctionArgs): Promise<ShopData> => {
    const url = new URL(args.request.url);
    const state = parseShopState(url.searchParams);
    const defaultSort: SortValue = kind === "new" ? "newest" : "featured";

    let title = "Shop";
    let description: string | null = null;
    let crumbs: Crumb[] = [HOME_CRUMB, SHOP_CRUMB];
    const scope: Record<string, string | boolean | undefined> = {};

    if (kind === "category") {
      const slug = args.params.category!;
      const category = await apiGet<{ name: string; description: string | null }>(
        args,
        `/api/catalog/categories/${encodeURIComponent(slug)}`,
      );
      title = category.name;
      description = category.description;
      crumbs = [HOME_CRUMB, SHOP_CRUMB, { label: category.name, to: `/shop/${slug}` }];
      scope.scopeCategory = slug;
    } else if (kind === "men" || kind === "women") {
      title = kind === "men" ? "Men" : "Women";
      crumbs = [HOME_CRUMB, { label: title, to: `/${kind}` }];
      scope.gender = kind;
    } else if (kind === "new") {
      title = "New Arrivals";
      crumbs = [HOME_CRUMB, { label: title, to: "/new-arrivals" }];
      scope.new = true;
    } else if (kind === "collection") {
      const slug = args.params.slug!;
      const collection = await apiGet<{ name: string; description: string | null }>(
        args,
        `/api/catalog/collections/${encodeURIComponent(slug)}`,
      );
      title = collection.name;
      description = collection.description;
      crumbs = [
        HOME_CRUMB,
        { label: "Collections", to: "/collections" },
        { label: collection.name, to: `/collections/${slug}` },
      ];
      scope.collection = slug;
    }

    const list = await apiGet<ProductListResponse>(
      args,
      `/api/catalog/products${toQuery({
        ...scope,
        category: state.categories.join(","),
        size: state.sizes.join(","),
        color: state.colors.join(","),
        minPrice: state.minPrice ?? undefined,
        maxPrice: state.maxPrice ?? undefined,
        inStock: state.inStock,
        sort: state.sort ?? defaultSort,
        page: state.page > 1 ? state.page : undefined,
      })}`,
    );

    return { kind, title, description, crumbs, list, state, defaultSort };
  };
}

export function ShopPage() {
  const { kind, title, description, crumbs, list, state, defaultSort } =
    useLoaderData() as ShopData;
  const { siteUrl } = useRootData();
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Dim the grid while a filter change is loading on this same page.
  const updating = navigation.state === "loading" && navigation.location?.pathname === pathname;
  const refined = hasRefinements(state);
  const showCategories = kind !== "category";
  const countLabel = `${list.total} ${list.total === 1 ? "product" : "products"}`;

  return (
    <main id="main" className="flex-1">
      <Meta
        title={state.page > 1 ? `${title} — page ${state.page}` : title}
        description={description}
        // Filtered and sorted views are near-duplicates: keep them out of the index.
        noindex={refined}
        canonicalPath={!refined && state.page > 1 ? `${pathname}?page=${state.page}` : pathname}
      />
      <JsonLd data={breadcrumbJsonLd(siteUrl, crumbs)} />

      <header className="container-page pt-8 pb-10 lg:pt-12 lg:pb-14">
        <Breadcrumbs crumbs={crumbs} />
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-h1">{title}</h1>
            {description && <p className="mt-4 max-w-[60ch] text-muted">{description}</p>}
          </div>
          <p className="label-caps text-muted" aria-live="polite">
            {countLabel}
          </p>
        </div>
      </header>

      <div className="container-page pb-section">
        <div className="sticky top-header z-20 -mx-gutter mb-8 flex items-center justify-between gap-4 border-y border-line bg-canvas px-gutter py-3 lg:static lg:mx-0 lg:border-x-0 lg:px-0">
          <Button
            variant="ghost"
            className="h-10 px-0 lg:hidden"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal aria-hidden className="size-4" />
            Filters
          </Button>
          <div className="hidden flex-1 lg:block">
            <ActiveFilters facets={list.facets} state={state} />
          </div>
          <SortSelect current={state.sort ?? defaultSort} defaultSort={defaultSort} />
        </div>

        <div className="mb-6 lg:hidden">
          <ActiveFilters facets={list.facets} state={state} />
        </div>

        <div className="grid-page gap-y-10">
          <aside className="hidden lg:col-span-3 lg:block" aria-label="Filters">
            <div className="sticky top-[calc(var(--header-height)+1.5rem)]">
              <FilterPanel facets={list.facets} state={state} showCategories={showCategories} />
            </div>
          </aside>

          <section
            aria-label="Products"
            aria-busy={updating}
            className={cn(
              "col-span-4 transition-opacity duration-200 md:col-span-8 lg:col-span-9",
              updating && "opacity-50",
            )}
          >
            {list.products.length > 0 ? (
              <>
                <ProductGrid products={list.products} columns={3} />
                <Pagination page={list.page} pageCount={list.pageCount} />
              </>
            ) : (
              <EmptyResults refined={refined} />
            )}
          </section>
        </div>
      </div>

      <Sheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filters"
        side="left"
        footer={
          <Button className="w-full" onClick={() => setFiltersOpen(false)}>
            Show {countLabel}
          </Button>
        }
      >
        <FilterPanel facets={list.facets} state={state} showCategories={showCategories} />
      </Sheet>
    </main>
  );
}

function SortSelect({ current, defaultSort }: { current: SortValue; defaultSort: SortValue }) {
  const [params, setParams] = useSearchParams();
  return (
    <label className="flex items-center gap-2">
      <span className="label-caps text-muted">Sort</span>
      <span className="relative inline-flex items-center">
        <select
          value={current}
          onChange={(event) =>
            setParams(
              setParam(
                params,
                "sort",
                event.target.value === defaultSort ? null : event.target.value,
              ),
              { preventScrollReset: true },
            )
          }
          className="h-10 cursor-pointer appearance-none border-b border-ink bg-transparent pe-6 label-caps focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute end-0 size-3.5" />
      </span>
    </label>
  );
}

function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const [params] = useSearchParams();
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const next = setParam(params, "page", target > 1 ? String(target) : null);
    const query = next.toString();
    return query ? `?${query}` : "?";
  };

  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link to={href(page - 1)} className={buttonClassName({ variant: "ghost" })}>
          Previous
        </Link>
      )}
      <ol className="flex items-center gap-1">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((target) => (
          <li key={target}>
            <Link
              to={href(target)}
              aria-current={target === page ? "page" : undefined}
              className={cn(
                "inline-flex size-10 items-center justify-center label-caps",
                target === page ? "bg-ink text-paper" : "hover:bg-line",
              )}
            >
              {target}
            </Link>
          </li>
        ))}
      </ol>
      {page < pageCount && (
        <Link to={href(page + 1)} className={buttonClassName({ variant: "ghost" })}>
          Next
        </Link>
      )}
    </nav>
  );
}

function EmptyResults({ refined }: { refined: boolean }) {
  const [params, setParams] = useSearchParams();
  return (
    <div className="flex flex-col items-center border border-line px-6 py-20 text-center">
      <p className="font-display text-h2">Nothing here yet</p>
      <p className="mt-4 max-w-[42ch] text-muted">
        {refined
          ? "No products match these filters. Try removing one or two."
          : "There are no products in this section yet."}
      </p>
      {refined ? (
        <Button
          variant="secondary"
          className="mt-8"
          onClick={() => setParams(clearRefinements(params), { preventScrollReset: true })}
        >
          Clear filters
        </Button>
      ) : (
        <Link to="/shop" className={buttonClassName({ variant: "secondary", className: "mt-8" })}>
          Browse everything
        </Link>
      )}
    </div>
  );
}
