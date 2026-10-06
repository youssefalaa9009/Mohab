import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { Suspense, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { useCart } from "@/features/cart/CartProvider";
import { useWishlist } from "@/features/wishlist/WishlistProvider";
import type { NavData } from "@/features/catalog/types";
import { useHeroWordmarkVisible } from "@/features/home/hero-visibility";
import { useScrollState } from "@/hooks/useScrollState";
import { Logo } from "@/components/brand/Brand";
import { cn } from "@/lib/cn";
import { lazyOnDemand } from "@/lib/lazy-on-demand";
import { MegaMenuItem } from "./MegaMenu";
import { MobileMenu } from "./MobileMenu";
import { primaryNav } from "./nav-items";

type HeaderProps = {
  nav: NavData | null;
  /**
   * True on pages whose hero sits behind the header (the homepage): the bar is
   * transparent with light text until the visitor scrolls.
   */
  overHero?: boolean;
};

/** Checkout keeps the brand and a way back, and drops everything else. */
export function CheckoutHeader() {
  return (
    <header className="border-b border-line bg-canvas text-ink">
      <div className="container-page flex h-header items-center justify-between gap-4">
        <Link to="/cart" className="link-underline label-caps">
          Back to bag
        </Link>
        <Link to="/" aria-label="QUATTRO — home">
          <Logo className="h-10" />
        </Link>
        <span className="label-caps text-muted">Secure checkout</span>
      </div>
    </header>
  );
}

export function Header({ nav, overHero = false }: HeaderProps) {
  const { scrolled, hidden } = useScrollState();
  const heroWordmarkVisible = useHeroWordmarkVisible();
  const items = primaryNav(nav);

  const onImage = overHero && !scrolled;
  // On the homepage the hero shows a giant wordmark; the header's only takes over once it is gone.
  const logoHidden = overHero && heroWordmarkVisible;

  return (
    <header
      data-surface={onImage ? "dark" : undefined}
      className={cn(
        "sticky top-0 z-50 transition-[transform,background-color,border-color,color] duration-300 ease-[var(--ease-out-expo)] motion-reduce:transition-none",
        // --badge-fg: text colour for badges drawn in currentColor (the bag count).
        onImage
          ? "border-b border-transparent bg-transparent text-bone [--badge-fg:var(--color-night)]"
          : // Frosted glass once the page scrolls beneath it.
            // Solid on phones (no content showing through), frosted glass on desktop.
            "border-b border-line bg-canvas text-ink [--badge-fg:var(--color-paper)] lg:bg-canvas/75 lg:backdrop-blur-xl lg:backdrop-saturate-150",
        // Hide on scroll down, return on scroll up. Focus inside always wins,
        // so keyboard users never chase a disappearing header.
        // Desktop only: on phones it stays pinned so nothing shows above it.
        hidden && "lg:-translate-y-full lg:focus-within:translate-y-0",
        // Solid behind an open category panel, even over the hero.
        "has-[[data-mega]:focus-within]:bg-canvas has-[[data-mega]:hover]:bg-canvas",
      )}
    >
      {/* Reading progress, driven by the scroll position in CSS. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 -bottom-px h-px scroll-progress bg-linear-to-r from-silver/40 via-silver to-bone",
          onImage && "opacity-0",
        )}
      />
      <div className="container-page flex h-header items-center justify-between gap-4">
        {/* Three balanced columns: nav, centred wordmark, actions. */}
        <div className="flex min-w-0 items-center gap-2 lg:flex-1">
          <MobileMenu
            items={items}
            categories={nav?.categories ?? []}
            byGender={nav?.byGender ?? null}
          />
          <Wordmark hidden={logoHidden} className="h-10 lg:hidden" />

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-x-6 xl:gap-x-8">
              {items.map((item) =>
                item.menu && nav?.byGender[item.menu].length ? (
                  <MegaMenuItem
                    key={item.to}
                    item={{ ...item, menu: item.menu }}
                    categories={nav.byGender[item.menu]}
                  />
                ) : (
                  <li key={item.to}>
                    <NavLink to={item.to} className="link-underline label-caps whitespace-nowrap">
                      {item.label}
                    </NavLink>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </div>

        <Wordmark hidden={logoHidden} className="hidden h-12 shrink-0 lg:inline-flex" />

        <div className="flex items-center justify-end gap-1 lg:flex-1">
          <SearchButton categories={nav?.categories ?? []} />
          <IconLink to="/account" label="Account" className="hidden sm:inline-flex">
            <User aria-hidden className="size-5" />
          </IconLink>
          <WishlistLink />
          <BagLink />
        </div>
      </div>
    </header>
  );
}

const searchOverlay = lazyOnDemand(() =>
  import("@/features/search/SearchOverlay").then((module) => ({ default: module.SearchOverlay })),
);

/** Like the bag: a real link to /search, upgraded to the overlay once interactive. */
function SearchButton({ categories }: { categories: NonNullable<NavData>["categories"] }) {
  const [open, setOpen] = useState(false);
  // Mounted on first open and kept, so the closing animation can play.
  const [mounted, setMounted] = useState(false);
  searchOverlay.usePrefetch();
  return (
    <>
      <Link
        to="/search"
        aria-label="Search"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          setMounted(true);
          setOpen(true);
        }}
        onPointerEnter={() => void searchOverlay.prefetch()}
        className="inline-flex size-11 items-center justify-center transition-opacity hover:opacity-60"
      >
        <Search aria-hidden className="size-5" />
      </Link>
      {mounted && (
        <Suspense fallback={null}>
          <searchOverlay.Component open={open} onOpenChange={setOpen} categories={categories} />
        </Suspense>
      )}
    </>
  );
}

function WishlistLink() {
  const { ids } = useWishlist();
  const count = ids.length;
  return (
    <Link
      to="/wishlist"
      aria-label={count ? `Wishlist, ${count} saved` : "Wishlist"}
      className="relative hidden size-11 items-center justify-center transition-opacity hover:opacity-60 sm:inline-flex"
    >
      <Heart aria-hidden className={cn("size-5", count > 0 && "fill-current")} />
    </Link>
  );
}

/**
 * A real link to /cart (works before hydration and for new-tab clicks); a plain
 * click opens the drawer instead of leaving the page.
 */
function BagLink() {
  const { cart, setDrawerOpen } = useCart();
  const count = cart.itemCount;
  return (
    <Link
      to="/cart"
      aria-label={count ? `Bag, ${count} ${count === 1 ? "item" : "items"}` : "Bag, empty"}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        setDrawerOpen(true);
      }}
      className="relative inline-flex size-11 items-center justify-center transition-opacity hover:opacity-60"
    >
      <ShoppingBag aria-hidden className="size-5" />
      {count > 0 && (
        <span
          aria-hidden
          // Remounts on change, replaying the pop so the update is noticed.
          key={count}
          className="absolute end-1 top-1.5 flex h-4 min-w-4 animate-[q-pop_400ms_var(--ease-out-expo)] items-center justify-center rounded-full bg-current px-1 text-[0.625rem] leading-none tabular-nums"
        >
          <span className="text-(--badge-fg)">{count}</span>
        </span>
      )}
    </Link>
  );
}

function Wordmark({ hidden, className }: { hidden: boolean; className: string }) {
  return (
    <Link
      to="/"
      aria-label="QUATTRO — home"
      className={cn(
        "inline-flex leading-none transition-opacity duration-500",
        // Visually hidden only: it stays in the tab order and reappears on focus.
        hidden && "opacity-0 focus-visible:opacity-100",
        className,
      )}
    >
      <Logo className="h-full" />
    </Link>
  );
}

function IconLink({
  to,
  label,
  className,
  children,
}: {
  to: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      // 44px minimum touch target.
      className={cn(
        "inline-flex size-11 items-center justify-center transition-opacity hover:opacity-60",
        className,
      )}
    >
      {children}
    </Link>
  );
}
