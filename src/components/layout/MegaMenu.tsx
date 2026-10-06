import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router";
import { Sparkle } from "@/components/brand/Brand";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import type { CategorySummary } from "@/features/catalog/types";
import { cn } from "@/lib/cn";
import type { NavItem } from "./nav-items";

/**
 * A top-level nav item ("Men") with a full-width panel of its categories.
 *
 * Opens on hover and on keyboard focus, in CSS, so it works before hydration.
 * The item spans the header's full height so the pointer can travel down into
 * the panel without it closing. After a pick, it stays shut until the pointer
 * leaves, so it doesn't hang open over the page you just navigated to.
 * Solid, not frosted: the header's own backdrop filter would stop a nested
 * one from reaching the page. A clipped spread shadow dims the page below.
 */
export function MegaMenuItem({
  item,
  categories,
}: {
  item: NavItem & { menu: "men" | "women" };
  categories: CategorySummary[];
}) {
  const [closed, setClosed] = useState(false);
  const base = `/${item.menu}`;
  const pick = () => {
    setClosed(true);
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const tiles = categories.filter((category) => category.imageKey).slice(0, 2);

  return (
    <li
      className="group/menu flex h-header items-center"
      onPointerLeave={() => setClosed(false)}
      // The header reads this to turn solid while a panel is open.
      data-mega={closed ? undefined : ""}
    >
      <NavLink to={item.to} className="link-underline label-caps whitespace-nowrap">
        {item.label}
      </NavLink>

      <div
        className={cn(
          "invisible absolute inset-x-0 top-full -translate-y-2 border-y border-line bg-canvas text-ink opacity-0 shadow-[0_0_0_100vmax_rgb(0_0_0/0.55)] transition-[opacity,translate,visibility] delay-100 duration-300 ease-[var(--ease-out-expo)] [clip-path:inset(0_-100vw_-100vh_-100vw)]",
          !closed &&
            "group-focus-within/menu:visible group-focus-within/menu:translate-y-0 group-focus-within/menu:opacity-100 group-hover/menu:visible group-hover/menu:translate-y-0 group-hover/menu:opacity-100 group-hover/menu:delay-75",
        )}
      >
        <div className="container-page grid grid-cols-12 gap-gutter py-10">
          <div className="col-span-5">
            <p className="flex items-center gap-2 label-caps text-muted">
              <Sparkle className="size-3 text-silver" />
              {item.label}
            </p>
            <ul className="mt-6 flex flex-col gap-1">
              <li>
                <Link
                  to={base}
                  onClick={pick}
                  className="group/link flex items-center gap-3 py-1 font-display text-h3 transition-colors hover:text-muted"
                >
                  All {item.label.toLowerCase()}
                  <ArrowRight
                    aria-hidden
                    className="size-4 -translate-x-2 opacity-0 transition-[opacity,translate] duration-300 group-hover/link:translate-x-0 group-hover/link:opacity-100 rtl:rotate-180"
                  />
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    to={`${base}?category=${category.slug}`}
                    onClick={pick}
                    className="group/link flex items-baseline gap-3 py-1 font-display text-h3 transition-colors hover:text-muted"
                  >
                    <span className="transition-transform duration-300 group-hover/link:translate-x-1 rtl:group-hover/link:-translate-x-1">
                      {category.name}
                    </span>
                    <span className="label-caps text-muted tabular-nums">
                      {category.productCount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2">
            <p className="label-caps text-muted">Discover</p>
            <ul className="mt-6 flex flex-col gap-3 text-small">
              <li>
                <Link to="/new-arrivals" onClick={pick} className="link-underline">
                  New arrivals
                </Link>
              </li>
              <li>
                <Link to="/collections" onClick={pick} className="link-underline">
                  Collections
                </Link>
              </li>
              <li>
                <Link to="/about#story" onClick={pick} className="link-underline">
                  Our story
                </Link>
              </li>
            </ul>
          </div>

          <ul className="col-span-5 grid grid-cols-2 gap-gutter">
            {tiles.map((category) => (
              <li key={category.slug}>
                <Link
                  to={`${base}?category=${category.slug}`}
                  onClick={pick}
                  tabIndex={-1}
                  aria-hidden
                  className="group/tile relative block aspect-[4/5] overflow-hidden"
                >
                  <ProductImage
                    image={{ key: category.imageKey!, alt: "", width: 1600, height: 2000 }}
                    decorative
                    sizes="20vw"
                    className="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/tile:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-night/80 to-transparent p-4 font-display text-h3 text-bone">
                    {category.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}
