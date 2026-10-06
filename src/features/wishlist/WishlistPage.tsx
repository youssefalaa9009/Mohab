import { useEffect, useState } from "react";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import { Link } from "react-router";
import { buttonClassName } from "@/components/ui/Button";
import { ProductGrid } from "@/features/catalog/components/ProductCard";
import type { ProductSummary } from "@/features/catalog/types";
import { Meta } from "@/lib/seo";
import { useWishlist } from "./WishlistProvider";

export function WishlistPage() {
  const { ids, ready, signedIn } = useWishlist();
  const [products, setProducts] = useState<ProductSummary[] | null>(null);

  // Load cards once the saved list is known; removals afterwards just filter.
  useEffect(() => {
    if (!ready || !ids.length) return;
    const controller = new AbortController();
    fetch(`/api/wishlist/products?ids=${ids.join(",")}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<ProductSummary[]>) : []))
      .then(setProducts)
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per load, not per toggle
  }, [ready]);

  const shown =
    ready && !ids.length ? [] : (products?.filter((product) => ids.includes(product.id)) ?? null);

  return (
    <main id="main" className="container-page flex-1 py-section">
      <Meta title="Wishlist" noindex />
      <h1 className="font-display text-h1">Wishlist</h1>
      {!signedIn && ready && (
        <p className="mt-4 text-muted">
          Saved on this device.{" "}
          <Link to="/account/login?next=/wishlist" className="text-ink underline">
            Sign in
          </Link>{" "}
          to keep your wishlist on every device.
        </p>
      )}

      <div className="mt-10">
        {shown === null ? (
          <div role="status" aria-busy>
            <span className="sr-only">Loading your wishlist…</span>
            <ProductGridSkeleton count={4} />
          </div>
        ) : shown.length === 0 ? (
          <div className="border border-line px-6 py-16 text-center">
            <p className="text-muted">
              Nothing saved yet. Tap the heart on any piece to keep it here.
            </p>
            <Link
              to="/shop"
              className={buttonClassName({ variant: "secondary", className: "mt-8" })}
            >
              Explore the shop
            </Link>
          </div>
        ) : (
          <ProductGrid products={shown} />
        )}
      </div>
    </main>
  );
}
