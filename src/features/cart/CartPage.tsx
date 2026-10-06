import { Link } from "react-router";
import { buttonClassName } from "@/components/ui/Button";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";
import { Meta } from "@/lib/seo";
import { CartLineItem, CartTotals, CouponForm } from "./CartLines";
import { useCart } from "./CartProvider";

export function CartPage() {
  const { cart } = useCart();
  const empty = cart.lines.length === 0;

  return (
    <main id="main" className="container-page flex-1 pt-10 pb-section lg:pt-14">
      <Meta title="Your bag" noindex />
      <h1 className="font-display text-h1">Your bag</h1>

      {empty ? (
        <div className="mt-12 flex flex-col items-start gap-6">
          <p className="text-muted">Your bag is empty.</p>
          <Link to="/shop" className={buttonClassName({ variant: "secondary" })}>
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid-page gap-y-12">
          <section aria-label="Items" className="col-span-4 md:col-span-8 lg:col-span-7">
            <ul className="border-t border-line">
              {cart.lines.map((line) => (
                <CartLineItem key={line.id} line={line} />
              ))}
            </ul>
          </section>

          <aside
            aria-label="Order summary"
            className="col-span-4 md:col-span-8 lg:col-span-4 lg:col-start-9"
          >
            <div className="flex flex-col gap-6 bg-surface p-6 lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
              <h2 className="label-caps">Summary</h2>
              <CouponForm />
              <CartTotals cart={cart} />
              <Link
                to="/checkout"
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
              <ul className="flex flex-col gap-1 text-caption text-muted">
                {site.paymentMethods.map((method) => (
                  <li key={method}>{method}</li>
                ))}
                <li>{site.policies.returnsSummary}</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
