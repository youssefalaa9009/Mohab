import { Link } from "react-router";
import { buttonClassName } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { CartLineItem, CartTotals, CouponForm } from "./CartLines";
import { useCart } from "./CartProvider";

export function CartDrawer() {
  const { cart, drawerOpen, setDrawerOpen, announcement } = useCart();
  const close = () => setDrawerOpen(false);
  const empty = cart.lines.length === 0;

  return (
    <Sheet
      open={drawerOpen}
      onOpenChange={setDrawerOpen}
      title={empty ? "Your bag" : `Your bag (${cart.itemCount})`}
      footer={
        empty ? undefined : (
          <div className="flex flex-col gap-4">
            <CartTotals cart={cart} />
            <Link
              to="/checkout"
              onClick={close}
              aria-disabled={cart.hasUnavailable || undefined}
              className={cn(
                buttonClassName({ className: "w-full" }),
                cart.hasUnavailable && "pointer-events-none opacity-40",
              )}
            >
              Checkout
            </Link>
            {cart.hasUnavailable && (
              <p className="text-caption text-danger">
                Remove unavailable items before checking out.
              </p>
            )}
            <Link to="/cart" onClick={close} className="link-underline self-center label-caps">
              View bag
            </Link>
          </div>
        )
      }
    >
      {/* Announces adds, removals and stock notices to screen readers. */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {empty ? (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="font-display text-h2">Your bag is empty</p>
          <p className="mt-3 text-small text-muted">
            Nothing here yet — the shop is a good place to start.
          </p>
          <Link
            to="/shop"
            onClick={close}
            className={buttonClassName({ variant: "secondary", className: "mt-8" })}
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          <ul>
            {cart.lines.map((line) => (
              <CartLineItem key={line.id} line={line} onNavigate={close} compact />
            ))}
          </ul>
          <div className="pt-6">
            <CouponForm />
          </div>
        </>
      )}
    </Sheet>
  );
}
