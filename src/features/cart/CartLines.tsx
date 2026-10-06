import { Minus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/Button";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { Price } from "@/features/catalog/components/Price";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { useHydrated } from "@/hooks/useHydrated";
import { useCart } from "./CartProvider";
import type { CartLine, CartView } from "./types";

function lineHref(line: CartLine) {
  return line.colorSlug
    ? `/products/${line.productSlug}?color=${line.colorSlug}`
    : `/products/${line.productSlug}`;
}

export function CartLineItem({
  line,
  onNavigate,
  compact = false,
}: {
  line: CartLine;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const { update, remove, pending } = useCart();
  const [error, setError] = useState<string | null>(null);
  const overStock = line.available && line.quantity > line.maxQuantity;

  const change = async (quantity: number) => {
    setError(null);
    const outcome = await update(line.id, quantity);
    if (!outcome.ok) setError(outcome.error);
  };

  return (
    <li className={cn("flex gap-4 border-b border-line py-5", !line.available && "opacity-60")}>
      <Link
        to={lineHref(line)}
        onClick={onNavigate}
        className={cn("block shrink-0 overflow-hidden", compact ? "w-20" : "w-24 md:w-32")}
        tabIndex={-1}
        aria-hidden
      >
        <div className="aspect-[4/5]">
          <ProductImage image={line.image} decorative sizes="8rem" />
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={lineHref(line)} onClick={onNavigate} className="text-small hover:underline">
              {line.productName}
            </Link>
            <p className="mt-1 text-caption text-muted">
              {[line.colorName, line.size && `Size ${line.size}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Price
            price={line.lineTotal}
            compareAtPrice={
              line.compareAtPrice
                ? { ...line.compareAtPrice, amount: line.compareAtPrice.amount * line.quantity }
                : null
            }
            className="shrink-0 text-end text-small"
          />
        </div>

        {!line.available ? (
          <p className="mt-2 text-caption text-danger">No longer available — please remove it.</p>
        ) : overStock ? (
          <p className="mt-2 text-caption text-warning">
            Only {line.maxQuantity} left — reduce the quantity to continue.
          </p>
        ) : line.stock === "low" ? (
          <p className="mt-2 text-caption text-warning">Low stock</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          {line.available ? (
            <div
              className="flex h-9 items-center border border-line-strong"
              role="group"
              aria-label={`Quantity of ${line.productName}`}
            >
              <button
                type="button"
                onClick={() => change(line.quantity - 1)}
                disabled={pending}
                aria-label="Decrease quantity"
                className="inline-flex size-9 items-center justify-center disabled:opacity-30"
              >
                <Minus aria-hidden className="size-3.5" />
              </button>
              <span className="w-6 text-center text-small tabular-nums" aria-live="polite">
                {line.quantity}
              </span>
              <button
                type="button"
                onClick={() => change(line.quantity + 1)}
                disabled={pending || line.quantity >= line.maxQuantity}
                aria-label="Increase quantity"
                className="inline-flex size-9 items-center justify-center disabled:opacity-30"
              >
                <Plus aria-hidden className="size-3.5" />
              </button>
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => remove(line.id)}
            disabled={pending}
            className="link-underline label-caps text-muted hover:text-ink"
          >
            Remove
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-caption text-danger">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

export function CouponForm() {
  const { cart, applyCoupon, removeCoupon, pending } = useCart();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);

  if (cart.coupon) {
    return (
      <div className="flex items-start justify-between gap-3 text-small">
        <div>
          <p>
            Code <span className="font-medium">{cart.coupon.code}</span> — {cart.coupon.label}
          </p>
          {cart.coupon.problem && (
            <p className="mt-1 text-caption text-warning">{cart.coupon.problem}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => removeCoupon()}
          disabled={pending}
          className="link-underline shrink-0 label-caps text-muted hover:text-ink"
        >
          Remove
        </button>
      </div>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    if (!code) return setError("Enter a code.");
    setError(null);
    const outcome = await applyCoupon(code);
    if (!outcome.ok) setError(outcome.error);
  };

  return (
    <form onSubmit={submit} method="post" noValidate>
      <label htmlFor="coupon-code" className="label-caps text-muted">
        Promo code
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="coupon-code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "coupon-error" : undefined}
          className="h-11 min-w-0 flex-1 rounded-input border border-line-strong bg-surface px-3 text-small uppercase focus:border-ink focus:outline-none aria-invalid:border-danger"
        />
        <Button
          type="submit"
          variant="secondary"
          className="h-11 px-4"
          loading={pending}
          disabled={!hydrated}
        >
          Apply
        </Button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="mt-2 text-caption text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

export function CartTotals({ cart, shippingLabel }: { cart: CartView; shippingLabel?: string }) {
  return (
    <dl className="flex flex-col gap-2 text-small">
      <div className="flex justify-between">
        <dt className="text-muted">Subtotal</dt>
        <dd className="tabular-nums">{formatMoney(cart.subtotal)}</dd>
      </div>
      {cart.discount.amount > 0 && (
        <div className="flex justify-between">
          <dt className="text-muted">Discount</dt>
          <dd className="tabular-nums">−{formatMoney(cart.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-muted">Delivery</dt>
        <dd>{shippingLabel ?? (cart.coupon?.freeShipping ? "Free" : "Calculated at checkout")}</dd>
      </div>
      <div className="mt-2 flex justify-between border-t border-line pt-3 text-body font-medium">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatMoney(cart.total)}</dd>
      </div>
    </dl>
  );
}
