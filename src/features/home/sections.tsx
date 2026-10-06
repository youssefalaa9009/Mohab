import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { LineReveal, Reveal } from "@/components/motion/Reveal";
import { buttonClassName } from "@/components/ui/Button";
import { ProductCard, ProductGrid } from "@/features/catalog/components/ProductCard";
import { Sparkle } from "@/components/brand/Brand";
import { site } from "@/config/site";
import { SpinningBadge } from "./Manifesto";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import type { CategorySummary, CollectionSummary, ProductSummary } from "@/features/catalog/types";

/** Numbered section heading — the 01 / 02 / 03 rhythm that runs down the homepage. */
export function SectionHeading({
  number,
  title,
  action,
  id,
}: {
  number: string;
  title: string;
  action?: ReactNode;
  id: string;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4 lg:mb-14">
      <div className="flex items-baseline gap-4">
        <span className="flex items-center gap-2 label-caps text-muted">
          <Sparkle className="size-3 text-silver" />
          {number}
        </span>
        <h2 id={id} className="font-display text-h2">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function ViewAll({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="link-underline label-caps">
      {label}
    </Link>
  );
}

/**
 * Horizontal rail on native scroll-snap: swipe on touch, arrow buttons on
 * desktop, and keyboard focus scrolls items into view. No scroll-jacking.
 */
export function ProductRail({
  number,
  title,
  products,
  viewAllHref,
}: {
  number: string;
  title: string;
  products: ProductSummary[];
  viewAllHref: string;
}) {
  const railRef = useRef<HTMLUListElement>(null);
  // Always begin at the first card: browsers may restore or snap a rail's
  // sideways scroll part-way along when a page is revisited.
  useEffect(() => {
    railRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, []);
  const id = `rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const scroll = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const rtl = getComputedStyle(rail).direction === "rtl";
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({
      left: direction * rail.clientWidth * 0.8 * (rtl ? -1 : 1),
      behavior: reduce ? "auto" : "smooth",
    });
  };

  if (!products.length) return null;
  return (
    <section aria-labelledby={id} className="py-section">
      <div className="container-page">
        <SectionHeading
          number={number}
          title={title}
          id={id}
          action={
            <div className="flex items-center gap-6">
              <div className="hidden gap-1 md:flex">
                <button
                  type="button"
                  onClick={() => scroll(-1)}
                  aria-label="Scroll back"
                  className="inline-flex size-11 items-center justify-center border border-line-strong hover:border-ink rtl:rotate-180"
                >
                  <ArrowLeft aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll(1)}
                  aria-label="Scroll forward"
                  className="inline-flex size-11 items-center justify-center border border-line-strong hover:border-ink rtl:rotate-180"
                >
                  <ArrowRight aria-hidden className="size-4" />
                </button>
              </div>
              <ViewAll to={viewAllHref} label="View all" />
            </div>
          }
        />
      </div>
      <ul
        ref={railRef}
        // Lined up with the page container on any screen width, first card at the left edge.
        className="scrollbar-none flex snap-x snap-mandatory scroll-px-(--rail-inset) gap-gutter overflow-x-auto px-(--rail-inset) [--rail-inset:max(var(--gutter),calc((100vw-120rem)/2+var(--gutter)))]"
      >
        {products.map((product, index) => (
          <li
            key={product.id}
            className="w-[72%] shrink-0 snap-start sm:w-[44%] md:w-[31%] lg:w-[23%]"
          >
            <ProductCard
              product={product}
              priority={index < 2}
              sizes="(min-width: 64rem) 23vw, 72vw"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FeaturedSection({
  number,
  products,
}: {
  number: string;
  products: ProductSummary[];
}) {
  if (!products.length) return null;
  return (
    <section aria-labelledby="featured-heading" className="container-page py-section">
      <SectionHeading
        number={number}
        title="Featured"
        id="featured-heading"
        action={<ViewAll to="/shop" label="Shop all" />}
      />
      {/* Whole rows only: four or eight, never a ragged last row. */}
      <ProductGrid products={products.slice(0, products.length >= 8 ? 8 : 4)} />
    </section>
  );
}

export function CategoryTiles({
  number,
  categories,
}: {
  number: string;
  categories: CategorySummary[];
}) {
  if (!categories.length) return null;
  return (
    <section aria-labelledby="categories-heading" className="container-page py-section">
      <SectionHeading number={number} title="Shop by category" id="categories-heading" />
      <ul className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
        {categories.map((category, index) => (
          <li key={category.slug}>
            <Reveal delay={index * 0.06}>
              <Link
                to={`/shop/${category.slug}`}
                className="group relative block aspect-[3/4] overflow-hidden"
              >
                <ProductImage
                  image={{
                    key: category.imageKey ?? `placeholder:${index % 4}`,
                    alt: "",
                    width: 1600,
                    height: 2000,
                  }}
                  decorative
                  sizes="(min-width: 64rem) 25vw, 50vw"
                  className="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04] motion-reduce:transition-none"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-night/60 to-transparent p-4 text-bone">
                  <span className="font-display text-h3">{category.name}</span>
                  <span className="label-caps tabular-nums">{category.productCount}</span>
                </div>
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Brand story block. The copy is QUATTRO's to write — until then it shows a
 * clearly marked placeholder rather than invented storytelling.
 */
export function EditorialStory({ number }: { number: string }) {
  const { founders } = site.images;
  return (
    <section
      id="story"
      aria-labelledby="story-heading"
      data-surface="dark"
      className="relative overflow-hidden border-y border-line bg-night py-section text-bone"
    >
      {/* The deck's light leak, drifting behind the section. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 -left-1/4 size-[60rem] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.07),transparent_60%)]"
      />
      <div className="relative container-page grid-page items-center gap-y-14">
        <Reveal className="relative col-span-4 md:col-span-6 md:col-start-2 lg:col-span-5 lg:col-start-1">
          <div className="relative aspect-square overflow-hidden">
            <ProductImage
              image={founders}
              sizes="(min-width: 64rem) 40vw, (min-width: 48rem) 70vw, 100vw"
              className="grayscale transition-transform duration-[1.6s] ease-[var(--ease-out-expo)] hover:scale-105"
            />
          </div>
          <SpinningBadge
            text="Four minds · One obsession · "
            className="absolute -end-6 -bottom-10 text-bone lg:-end-14"
          />
          <Sparkle className="absolute -start-3 -top-3 size-6 text-silver" />
        </Reveal>

        <div className="col-span-4 md:col-span-8 lg:col-span-6 lg:col-start-7">
          <span className="flex items-center gap-2 label-caps text-bone/60">
            <Sparkle className="size-3 text-silver" />
            {number} — The house
          </span>
          <LineReveal
            as="h2"
            lines={[...site.story.headline]}
            className="mt-6 font-display text-h1"
          />
          <Reveal delay={0.15}>
            <p className="mt-8 max-w-[52ch] text-bone/75">{site.story.body}</p>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-6 font-display text-h3 italic">{site.story.signoff}</p>
            <Link
              to="/about#story"
              className={buttonClassName({
                variant: "secondary",
                className: "group mt-10 gap-3 border-bone text-bone hover:bg-bone hover:text-night",
              })}
            >
              Our story
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180"
              />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function CollectionsTeaser({
  number,
  collections,
}: {
  number: string;
  collections: CollectionSummary[];
}) {
  if (!collections.length) return null;
  return (
    <section aria-labelledby="collections-heading" className="container-page py-section">
      <SectionHeading
        number={number}
        title="Collections"
        id="collections-heading"
        action={<ViewAll to="/collections" label="All collections" />}
      />
      <ul className="grid gap-gutter md:grid-cols-2">
        {collections.slice(0, 2).map((collection, index) => (
          <li key={collection.slug}>
            <Reveal delay={index * 0.08}>
              <Link to={`/collections/${collection.slug}`} className="group block">
                <div className="aspect-[16/10] overflow-hidden">
                  <ProductImage
                    image={{
                      key: collection.heroImageKey ?? `placeholder:${(index + 3) % 4}`,
                      alt: "",
                      width: 1600,
                      height: 1000,
                    }}
                    decorative
                    sizes="(min-width: 48rem) 50vw, 100vw"
                    className="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-h3">{collection.name}</h3>
                  <span className="label-caps text-muted">
                    {collection.productCount} {collection.productCount === 1 ? "piece" : "pieces"}
                  </span>
                </div>
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
