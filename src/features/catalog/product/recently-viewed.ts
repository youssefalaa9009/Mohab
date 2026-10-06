import { useEffect, useState } from "react";
import { toQuery } from "@/lib/api";
import type { ProductListResponse, ProductSummary } from "../types";

const STORAGE_KEY = "quattro:recently-viewed";
const LIMIT = 8;

function read(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function remember(slug: string) {
  try {
    const next = [slug, ...read().filter((item) => item !== slug)].slice(0, LIMIT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage disabled: the feature simply stays empty.
  }
}

/**
 * Products this browser viewed before the current one. Kept in localStorage
 * (a per-device convenience, nothing is sent anywhere) and loaded after
 * hydration, so it never affects the server-rendered page.
 */
export function useRecentlyViewed(currentSlug: string) {
  const [products, setProducts] = useState<ProductSummary[]>([]);

  useEffect(() => {
    const slugs = read().filter((slug) => slug !== currentSlug);
    remember(currentSlug);
    // Nothing to load; state starts empty because the view remounts per product.
    if (!slugs.length) return;

    const controller = new AbortController();
    fetch(`/api/catalog/products${toQuery({ slugs: slugs.join(","), pageSize: LIMIT })}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? (response.json() as Promise<ProductListResponse>) : null))
      .then((data) => {
        if (!data) return;
        // Keep most-recent-first order; drop anything no longer on sale.
        const bySlug = new Map(data.products.map((product) => [product.slug, product]));
        setProducts(
          slugs.map((slug) => bySlug.get(slug)).filter((product) => product !== undefined),
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [currentSlug]);

  return products;
}
