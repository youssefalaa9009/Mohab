import type { NavData } from "@/features/catalog/types";

export type NavItem = {
  label: string;
  to: string;
  /** Opens that side's category panel (desktop) or sub-links (mobile menu). */
  menu?: "men" | "women";
};

/**
 * Primary navigation, built from the live catalog: Men and Women only appear
 * when products for them exist, Collections only when a collection is live.
 * With no catalog data (an outage) it falls back to links that always resolve.
 */
export function primaryNav(nav: NavData | null): NavItem[] {
  const items: NavItem[] = [
    { label: "Shop", to: "/shop" },
    { label: "New Arrivals", to: "/new-arrivals" },
  ];
  if (nav?.genders.includes("men")) items.push({ label: "Men", to: "/men", menu: "men" });
  if (nav?.genders.includes("women")) items.push({ label: "Women", to: "/women", menu: "women" });
  if (!nav || nav.hasCollections) items.push({ label: "Collections", to: "/collections" });
  items.push({ label: "About", to: "/about#story" });
  return items;
}

export function footerNav(nav: NavData | null): { heading: string; items: NavItem[] }[] {
  return [
    {
      heading: "Shop",
      items: [
        { label: "New Arrivals", to: "/new-arrivals" },
        ...(nav?.categories ?? []).map((category) => ({
          label: category.name,
          to: `/shop/${category.slug}`,
        })),
        ...(nav?.hasCollections ? [{ label: "Collections", to: "/collections" }] : []),
      ],
    },
    {
      heading: "Customer Service",
      items: [
        { label: "Contact", to: "/contact" },
        { label: "FAQ", to: "/faq" },
        { label: "Shipping", to: "/help/shipping" },
        { label: "Returns", to: "/help/returns" },
        { label: "Track Order", to: "/help/track-order" },
      ],
    },
    {
      heading: "QUATTRO",
      items: [
        { label: "About", to: "/about" },
        { label: "Privacy Policy", to: "/legal/privacy" },
        { label: "Terms & Conditions", to: "/legal/terms" },
        { label: "Cookie Policy", to: "/legal/cookies" },
      ],
    },
  ];
}
