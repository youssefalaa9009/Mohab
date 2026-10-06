import { Menu } from "lucide-react";
import { Suspense, useState } from "react";
import type { CategorySummary, NavData } from "@/features/catalog/types";
import { lazyOnDemand } from "@/lib/lazy-on-demand";
import type { NavItem } from "./nav-items";

const sheet = lazyOnDemand(() =>
  import("./MobileMenuSheet").then((module) => ({ default: module.MobileMenuSheet })),
);

/** The menu button; the sheet itself loads on first tap (or when the page goes idle). */
export function MobileMenu({
  items,
  categories,
  byGender,
}: {
  items: NavItem[];
  categories: CategorySummary[];
  byGender: NavData["byGender"] | null;
}) {
  const [open, setOpen] = useState(false);
  // Mounted on first open and kept, so the closing animation can play.
  const [mounted, setMounted] = useState(false);
  sheet.usePrefetch();

  return (
    <>
      {/*
        A real link until the page is interactive: on a slow connection the
        sheet's code may not be there yet, and a tap must still lead somewhere —
        the footer, which carries every site link.
      */}
      <a
        href="#site-links"
        role="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          setMounted(true);
          setOpen(true);
        }}
        className="-ms-2 inline-flex size-11 touch-manipulation items-center justify-center lg:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </a>
      {mounted && (
        <Suspense fallback={null}>
          <sheet.Component
            items={items}
            categories={categories}
            byGender={byGender}
            open={open}
            onOpenChange={setOpen}
          />
        </Suspense>
      )}
    </>
  );
}
