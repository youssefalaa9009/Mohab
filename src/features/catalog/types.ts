/**
 * Catalog API contract — produced by server/routes/catalog.ts, consumed by the
 * storefront. Plain serialisable data only: it crosses the wire as JSON and is
 * embedded in the hydration payload.
 */

export type ImageRef = {
  /** Storage key. `placeholder:N` renders a labelled tone block until photography exists. */
  key: string;
  alt: string;
  width: number;
  height: number;
};

export type Money = {
  /** Integer minor units (piastres). */
  amount: number;
  currency: string;
};

export type StockLevel = "in" | "low" | "out";

export type ColorSummary = {
  slug: string;
  name: string;
  hex: string | null;
  image: ImageRef | null;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  category: { slug: string; name: string };
  gender: "men" | "women" | "unisex";
  /** Lowest active variant price. */
  price: Money;
  /** Compare-at price of that variant, when it is on sale. */
  compareAtPrice: Money | null;
  isNew: boolean;
  soldOut: boolean;
  colors: ColorSummary[];
  primaryImage: ImageRef | null;
  hoverImage: ImageRef | null;
};

export type FacetOption = { value: string; label: string; count?: number; hex?: string | null };

export type Facets = {
  categories: FacetOption[];
  sizes: FacetOption[];
  colors: FacetOption[];
  price: { min: number; max: number } | null;
};

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "best-selling", label: "Best selling" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export type ProductListResponse = {
  products: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: Facets;
};

export type VariantInfo = {
  id: string;
  colorSlug: string | null;
  size: string | null;
  sku: string;
  price: Money;
  compareAtPrice: Money | null;
  stock: StockLevel;
};

export type ColorDetail = {
  slug: string;
  name: string;
  hex: string | null;
  images: ImageRef[];
};

export type SizeChart = {
  name: string;
  unit: "cm" | "in";
  columns: string[];
  rows: { size: string; values: string[] }[];
  notes: string | null;
};

export type ProductDetail = ProductSummary & {
  description: string | null;
  material: string | null;
  fit: string | null;
  care: string | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  colorDetails: ColorDetail[];
  /** Images not tied to a colour. */
  sharedImages: ImageRef[];
  /** Sizes in display order (empty for one-size products). */
  sizes: string[];
  variants: VariantInfo[];
  sizeChart: SizeChart | null;
  collections: { slug: string; name: string }[];
  related: ProductSummary[];
  completeTheLook: ProductSummary[];
};

export type CategorySummary = {
  slug: string;
  name: string;
  productCount: number;
  /** Set in Admin → Categories; null shows a placeholder. */
  imageKey: string | null;
};

export type CollectionSummary = {
  slug: string;
  name: string;
  description: string | null;
  heroImageKey: string | null;
  productCount: number;
};

export type NavData = {
  categories: CategorySummary[];
  /** Genders with at least one product, so Men/Women links only appear when real. */
  genders: ("men" | "women")[];
  /** Categories with products for each side (unisex pieces count for both): the Men/Women menus. */
  byGender: Record<"men" | "women", CategorySummary[]>;
  hasCollections: boolean;
};

export type HomeData = {
  newArrivals: ProductSummary[];
  featured: ProductSummary[];
  bestSellers: ProductSummary[];
  categories: CategorySummary[];
  collections: CollectionSummary[];
};
