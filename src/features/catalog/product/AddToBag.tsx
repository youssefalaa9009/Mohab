import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/features/cart/CartProvider";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import type { VariantInfo } from "../types";

type AddToBagProps = {
  variant: VariantInfo | null;
  quantity: number;
  needsSize: boolean;
  soldOut: boolean;
  /** "Buy now": add, then go straight to checkout. */
  buyNow?: boolean;
  className?: string;
};

/**
 * Stays enabled when no size is chosen yet and asks for one on click — a
 * disabled button gives no clue why it can't be pressed.
 */
export function AddToBag({
  variant,
  quantity,
  needsSize,
  soldOut,
  buyNow = false,
  className,
}: AddToBagProps) {
  const { add } = useCart();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const variantSoldOut = variant?.stock === "out";
  const disabled = soldOut || variantSoldOut;
  const label = soldOut
    ? "Sold out"
    : variantSoldOut
      ? "Sold out in this size"
      : buyNow
        ? "Buy now"
        : "Add to bag";

  const submit = async () => {
    if (needsSize || !variant) {
      setMessage({ text: "Please choose a size.", error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    const outcome = await add(variant.id, quantity, { openDrawer: !buyNow });
    setBusy(false);
    if (!outcome.ok) {
      setMessage({ text: outcome.error, error: true });
      return;
    }
    if (outcome.notice) setMessage({ text: outcome.notice, error: false });
    if (buyNow) navigate("/checkout");
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        variant={buyNow ? "secondary" : "primary"}
        className="w-full"
        disabled={disabled || !hydrated}
        loading={busy}
        onClick={submit}
      >
        {label}
      </Button>
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={cn("text-caption", message.error ? "text-danger" : "text-muted")}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
