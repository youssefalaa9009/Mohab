import { SORT_OPTIONS, type SortValue } from "../types";

/** Filter state as it appears in the storefront URL. */
export type ShopState = {
  categories: string[];
  sizes: string[];
  colors: string[];
  /** Whole currency units, as typed by the shopper. */
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  sort: SortValue | null;
  page: number;
};

export type MultiKey = "category" | "size" | "color";

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((option) => option.value));

function list(params: URLSearchParams, key: string) {
  return (params.get(key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function wholeNumber(value: string | null) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function parseShopState(params: URLSearchParams): ShopState {
  const sort = params.get("sort");
  const page = Number(params.get("page"));
  return {
    categories: list(params, "category"),
    sizes: list(params, "size"),
    colors: list(params, "color"),
    minPrice: wholeNumber(params.get("minPrice")),
    maxPrice: wholeNumber(params.get("maxPrice")),
    inStock: params.get("inStock") === "1",
    sort: sort && SORT_VALUES.has(sort) ? (sort as SortValue) : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** True when the shopper has narrowed or reordered the listing. */
export function hasRefinements(state: ShopState) {
  return (
    state.categories.length > 0 ||
    state.sizes.length > 0 ||
    state.colors.length > 0 ||
    state.minPrice !== null ||
    state.maxPrice !== null ||
    state.inStock ||
    state.sort !== null
  );
}

/**
 * Returns new search params with `value` toggled in a comma list. Any change
 * to filters sends the shopper back to page 1.
 */
export function toggleValue(params: URLSearchParams, key: MultiKey, value: string) {
  const next = new URLSearchParams(params);
  const values = new Set(list(params, key));
  if (values.has(value)) values.delete(value);
  else values.add(value);
  if (values.size) next.set(key, [...values].join(","));
  else next.delete(key);
  next.delete("page");
  return next;
}

export function setParam(params: URLSearchParams, key: string, value: string | null) {
  const next = new URLSearchParams(params);
  if (value === null || value === "") next.delete(key);
  else next.set(key, value);
  if (key !== "page") next.delete("page");
  return next;
}

export function clearRefinements(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const key of [
    "category",
    "size",
    "color",
    "minPrice",
    "maxPrice",
    "inStock",
    "sort",
    "page",
  ]) {
    next.delete(key);
  }
  return next;
}
