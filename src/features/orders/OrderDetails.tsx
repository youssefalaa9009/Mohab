import type { OrderSummary } from "@/features/checkout/schema";
import { formatMoney } from "@/lib/money";

/** Items, totals and delivery address — shared by the account and order tracking. */
export function OrderDetails({ order }: { order: OrderSummary }) {
  const money = (amount: number) => formatMoney({ amount, currency: order.currency });
  return (
    <>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {order.items.map((item, index) => (
          <li key={index} className="flex justify-between gap-4 py-3 text-small">
            <span>
              {item.productName}
              <span className="block text-caption text-muted">
                {[item.variantLabel, `Qty ${item.quantity}`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="tabular-nums">{money(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 flex max-w-sm flex-col gap-1 text-small">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="tabular-nums">{money(order.subtotal)}</dd>
        </div>
        {order.discountTotal > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Discount</dt>
            <dd className="tabular-nums">−{money(order.discountTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Delivery</dt>
          <dd className="tabular-nums">
            {order.shippingTotal === 0 ? "Free" : money(order.shippingTotal)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(order.total)}</dd>
        </div>
      </dl>
      <h3 className="mt-8 label-caps">Delivering to</h3>
      <address className="mt-2 text-small text-muted not-italic">
        {order.shippingAddress.fullName}
        <br />
        {order.shippingAddress.line1}
        {order.shippingAddress.line2 && (
          <>
            <br />
            {order.shippingAddress.line2}
          </>
        )}
        <br />
        {order.shippingAddress.city}, {order.shippingAddress.region}
      </address>
    </>
  );
}
