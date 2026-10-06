import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { WishlistButton } from "@/features/wishlist/WishlistButton";
import { cn } from "@/lib/cn";
import type { ProductSummary } from "../types";
import { Price } from "./Price";
import { ProductImage } from "./ProductImage";

type ProductCardProps = {
  product: ProductSummary;
  /** First row of a grid: load images eagerly. */
  priority?: boolean;
  sizes?: string;
  /** Extra controls over the image (quick add, wishlist) — rendered above the card link. */
  actions?: ReactNode;
};

export function productHref(product: ProductSummary, colorSlug?: string | null) {
  const defaultColor = product.colors[0]?.slug;
  return colorSlug && colorSlug !== defaultColor
    ? `/products/${product.slug}?color=${colorSlug}`
    : `/products/${product.slug}`;
}

/**
 * Whole-card link via a stretched pseudo-element on the product name, so there
 * is one link per product for screen readers, while swatches and actions sit
 * above it and stay independently clickable.
 */
export function ProductCard({ product, priority = false, sizes, actions }: ProductCardProps) {
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const active = product.colors.find((color) => color.slug === activeColor);
  const image = active?.image ?? product.primaryImage;
  // The hover photo belongs to the default colour; skip it once another colour is chosen.
  const hoverImage = active ? null : product.hoverImage;

  return (
    <article
      className="group @container relative flex flex-col"
      // Feeds the "View" bubble its position over the photo; CSS variables, no re-render.
      onPointerMove={(event) => {
        const media = mediaRef.current;
        if (!media) return;
        const box = media.getBoundingClientRect();
        media.style.setProperty("--cx", `${event.clientX - box.left}px`);
        media.style.setProperty("--cy", `${event.clientY - box.top}px`);
      }}
    >
      <div ref={mediaRef} className="relative aspect-[4/5] overflow-hidden bg-stone-1">
        <ProductImage
          image={image}
          decorative
          priority={priority}
          sizes={sizes}
          className="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        {hoverImage && (
          // Second photo crossfades in on hover — only on devices that can hover.
          <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none">
            <ProductImage image={hoverImage} decorative sizes={sizes} />
          </div>
        )}

        <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
          {product.soldOut ? (
            <Badge tone="soldOut">Sold out</Badge>
          ) : (
            <>
              {product.isNew && <Badge>New</Badge>}
              {product.compareAtPrice && <Badge tone="sale">Sale</Badge>}
            </>
          )}
        </div>

        {/* A "View" bubble trailing the cursor — mouse devices only, purely decorative. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 z-[5] hidden size-20 translate-x-[calc(var(--cx,50%)-50%)] translate-y-[calc(var(--cy,50%)-50%)] scale-50 items-center justify-center rounded-full bg-bone/90 label-caps text-night opacity-0 backdrop-blur-sm transition-[opacity,scale] duration-300 ease-[var(--ease-out-expo)] group-hover:scale-100 group-hover:opacity-100 pointer-fine:flex"
        >
          View
        </span>
        <WishlistButton
          productId={product.id}
          productName={product.name}
          className="absolute end-2 top-2 z-10"
        />
        {actions && <div className="absolute inset-x-0 bottom-0 z-10">{actions}</div>}
      </div>

      {/* Side by side when the card is wide enough; stacked on narrow phone cards. */}
      <div className="mt-3 flex flex-col gap-1">
        <h3 className="text-small">
          <Link
            to={productHref(product, activeColor)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[var(--focus-ring)]"
          >
            {product.name}
          </Link>
        </h3>
        <Price
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          className="text-small"
        />
      </div>

      {product.colors.length > 1 && (
        <ul className="relative z-10 mt-2 flex items-center gap-1.5" aria-label="Colours">
          {product.colors.map((color) => (
            <li key={color.slug}>
              <button
                type="button"
                aria-label={`Show in ${color.name}`}
                aria-pressed={(activeColor ?? product.colors[0]?.slug) === color.slug}
                onMouseEnter={() => setActiveColor(color.slug)}
                onFocus={() => setActiveColor(color.slug)}
                onClick={() => setActiveColor(color.slug)}
                className={cn(
                  // 24px hit area around a 12px swatch.
                  "flex size-6 items-center justify-center rounded-full",
                  "after:block after:size-3 after:rounded-full after:border after:border-line-strong after:bg-[var(--swatch)] after:content-['']",
                  "aria-pressed:ring-1 aria-pressed:ring-ink",
                )}
                style={{ "--swatch": color.hex ?? "transparent" } as React.CSSProperties}
              />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ProductGrid({
  products,
  columns = 4,
  className,
  renderActions,
}: {
  products: ProductSummary[];
  /** Columns at the widest breakpoint: 3 beside a filter sidebar, 4 full width. */
  columns?: 3 | 4;
  className?: string;
  renderActions?: (product: ProductSummary) => ReactNode;
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-gutter gap-y-10 md:grid-cols-3 lg:gap-y-14",
        columns === 4 && "xl:grid-cols-4",
        className,
      )}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            priority={index < 4}
            sizes={
              columns === 4
                ? "(min-width: 80rem) 25vw, (min-width: 48rem) 33vw, 50vw"
                : "(min-width: 48rem) 33vw, 50vw"
            }
            actions={renderActions?.(product)}
          />
        </li>
      ))}
    </ul>
  );
}
