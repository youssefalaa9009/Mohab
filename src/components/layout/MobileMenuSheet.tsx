import { Drawer } from "@base-ui/react/drawer";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Logo } from "@/components/brand/Brand";
import type { CategorySummary, NavData } from "@/features/catalog/types";
import type { NavItem } from "./nav-items";

/**
 * Mobile navigation: a panel sliding in from the left, about 85% of the
 * screen wide, so a strip of the (dimmed) site stays in view on the right —
 * tap it, swipe left or press ✕ to close. Every entry is a full-width row;
 * Shop, Men and Women expand in place to their categories.
 *
 * Loaded on demand by `MobileMenu`. Base UI's Drawer handles focus trapping,
 * scroll locking and the swipe; transitions are transform/opacity only, and
 * off for reduced motion.
 */
export function MobileMenuSheet({
  items,
  categories,
  byGender,
  open,
  onOpenChange,
}: {
  items: NavItem[];
  categories: CategorySummary[];
  byGender: NavData["byGender"] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { pathname } = useLocation();
  const close = () => onOpenChange(false);

  /** Sub-rows for an expandable entry: "All …" first, then its categories. */
  const groupFor = (item: NavItem): { label: string; to: string }[] | null => {
    if (item.to === "/shop" && categories.length) {
      return [
        { label: "All products", to: "/shop" },
        ...categories.map((category) => ({
          label: category.name,
          to: `/shop/${category.slug}`,
        })),
      ];
    }
    if (item.menu && byGender && byGender[item.menu].length) {
      return [
        { label: `All ${item.label.toLowerCase()}`, to: item.to },
        ...byGender[item.menu].map((category) => ({
          label: category.name,
          to: `${item.to}?category=${category.slug}`,
        })),
      ];
    }
    return null;
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="left">
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 min-h-dvh bg-black/60 opacity-[calc(1-var(--drawer-swipe-progress))] backdrop-blur-[2px] transition-opacity duration-500 ease-[var(--ease-drawer)] data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute" />

        <Drawer.Viewport className="fixed inset-0 flex">
          <Drawer.Popup className="flex h-dvh w-[85%] max-w-sm [transform:translateX(var(--drawer-swipe-movement-x))] flex-col overflow-y-auto overscroll-contain border-e border-line bg-canvas text-ink shadow-[24px_0_60px_rgb(0_0_0/0.5)] transition-transform duration-500 ease-[var(--ease-drawer)] outline-none data-ending-style:[transform:translateX(-100%)] data-starting-style:[transform:translateX(-100%)] motion-reduce:transition-none rtl:data-ending-style:[transform:translateX(100%)] rtl:data-starting-style:[transform:translateX(100%)]">
            <Drawer.Content className="flex min-h-full flex-col px-gutter pt-4 pb-8">
              <div className="flex items-center justify-between">
                <Drawer.Title>
                  <span className="sr-only">QUATTRO</span>
                  <Logo className="h-9" />
                </Drawer.Title>
                <Drawer.Close
                  aria-label="Close menu"
                  className="-me-2 inline-flex size-11 items-center justify-center"
                >
                  <X aria-hidden className="size-5" />
                </Drawer.Close>
              </div>
              <Drawer.Description className="sr-only">Site navigation</Drawer.Description>

              <nav aria-label="Main" className="mt-6">
                <ul className="border-t border-line">
                  {items.map((item) => {
                    const group = groupFor(item);
                    const current = pathname === item.to.split("#")[0];
                    return (
                      <li key={item.to} className="border-b border-line">
                        {group ? (
                          <details className="group" open={current || undefined}>
                            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-display text-h3 [&::-webkit-details-marker]:hidden">
                              {item.label}
                              <ChevronDown
                                aria-hidden
                                className="size-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180"
                              />
                            </summary>
                            <ul className="mb-3 border-s border-line-strong">
                              {group.map((row) => (
                                <li key={row.to}>
                                  <Row to={row.to} onClick={close} sub>
                                    {row.label}
                                  </Row>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <Row to={item.to} onClick={close} current={current}>
                            <span className="font-display text-h3">{item.label}</span>
                          </Row>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <ul className="mt-auto border-t border-line pt-2">
                {[
                  { label: "Account", to: "/account" },
                  { label: "Wishlist", to: "/wishlist" },
                  { label: "Track order", to: "/help/track-order" },
                  { label: "Contact", to: "/contact" },
                ].map((row) => (
                  <li key={row.to}>
                    <Row to={row.to} onClick={close} small>
                      {row.label}
                    </Row>
                  </li>
                ))}
              </ul>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** One full-width, tappable row with a chevron. */
function Row({
  to,
  onClick,
  children,
  current = false,
  sub = false,
  small = false,
}: {
  to: string;
  onClick: () => void;
  children: ReactNode;
  current?: boolean;
  sub?: boolean;
  small?: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      className={
        sub
          ? "flex min-h-12 items-center justify-between gap-4 ps-4 text-body text-ink/85 transition-colors hover:text-ink active:bg-surface"
          : small
            ? "flex min-h-11 items-center justify-between gap-4 label-caps text-muted transition-colors hover:text-ink active:bg-surface"
            : "flex min-h-14 items-center justify-between gap-4 transition-colors active:bg-surface aria-[current=page]:italic"
      }
    >
      {children}
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted rtl:rotate-180" />
    </Link>
  );
}
