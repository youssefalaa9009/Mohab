import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";
import { useWishlist } from "./WishlistProvider";

/**
 * Heart toggle. A pressed/unpressed button with a fixed name, so screen readers
 * announce "Save Linen Shirt, toggle button, pressed" rather than a changing label.
 * Hidden until the saved list has loaded — it needs JavaScript to do anything.
 */
export function WishlistButton({
  productId,
  productName,
  className,
  variant = "overlay",
}: {
  productId: string;
  productName: string;
  className?: string;
  /** "overlay" sits on a product photo; "outline" stands beside other buttons. */
  variant?: "overlay" | "outline";
}) {
  const { ready, has, toggle } = useWishlist();
  if (!ready) return null;
  const saved = has(productId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`Save ${productName}`}
      title={saved ? "Remove from wishlist" : "Save to wishlist"}
      onClick={() => void toggle(productId)}
      className={cn(
        "inline-flex items-center justify-center transition-[opacity,transform] active:scale-90 motion-reduce:transition-none",
        variant === "overlay"
          ? "size-10 rounded-full bg-paper/80 text-ink backdrop-blur-sm hover:bg-paper"
          : "size-12 shrink-0 border border-line-strong hover:border-ink",
        className,
      )}
    >
      <Heart aria-hidden className={cn("size-[1.125rem]", saved && "fill-current")} />
    </button>
  );
}
