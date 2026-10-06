import type { CategorySummary, ProductSummary } from "@/features/catalog/types";

/** Mirrors server/catalog/search.ts. */
export type SearchResults = {
  query: string;
  products: ProductSummary[];
  categories: CategorySummary[];
  total: number;
};
