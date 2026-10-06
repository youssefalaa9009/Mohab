import { Check } from "lucide-react";
import { useState } from "react";
import { Link, useLoaderData, useSearchParams, type LoaderFunctionArgs } from "react-router";
import { buttonClassName } from "@/components/ui/Button";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { InstapayPanel } from "@/features/orders/InstapayPanel";
import { apiGet } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Meta } from "@/lib/seo";
import type { OrderSummary } from "./schema";

export async function confirmationLoader(args: LoaderFunctionArgs) {
  const key = new URL(args.request.url).searchParams.get("key") ?? "";
  return apiGet<OrderSummary>(
    args,
    `/api/orders/${encodeURIComponent(args.params.number!)}?key=${encodeURIComponent(key)}`,
  );
}

export function ConfirmationPage() {
  const loaded = useLoaderData() as OrderSummary;
  const [params] = useSearchParams();
  // Replaced in place when the customer submits an InstaPay reference.
  const [order, setOrder] = useState(loaded);
  const money = (amount: number) => formatMoney({ amount, currency: order.currency });
  const address = order.shippingAddress;

  return (
    <main id="main" className="container-page flex-1 py-12 lg:py-20">
      <Meta title={`Order ${order.number}`} noindex />

      <div className="mx-auto max-w-2xl">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-paper">
          <Check aria-hidden className="size-6" />
        </span>
        <p className="mt-8 label-caps text-muted">Order {order.number}</p>
        <h1 className="mt-3 font-display text-h1">Thank you — your order is in.</h1>

        {order.instapay ? (
          <div className="mt-10">
            <InstapayPanel
              order={order}
              submitPath={`/api/orders/${encodeURIComponent(order.number)}/instapay`}
              extraBody={{ key: params.get("key") ?? "" }}
              onUpdated={setOrder}
            />
          </div>
        ) : (
          <ol className="mt-10 flex flex-col gap-4 border-y border-line py-8">
            <Step number={1} title="We call to confirm">
              We’ll call <span className="text-ink">{order.phone}</span> shortly to confirm your
              order and delivery details.
            </Step>
            <Step number={2} title="We pack and ship">
              Once confirmed, your order is prepared and handed to the courier.
            </Step>
            <Step number={3} title="Pay on delivery">
              Pay {money(order.total)} in cash when your order arrives.
            </Step>
          </ol>
        )}

        <section aria-labelledby="items-heading" className="mt-10">
          <h2 id="items-heading" className="label-caps">
            Your order
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {order.items.map((item, index) => (
              <li key={index} className="flex gap-4">
                <div className="w-16 shrink-0">
                  <div className="aspect-[4/5]">
                    <ProductImage
                      image={
                        item.imageKey
                          ? { key: item.imageKey, alt: "", width: 800, height: 1000 }
                          : null
                      }
                      decorative
                      sizes="4rem"
                    />
                  </div>
                </div>
                <div className="flex-1 text-small">
                  <p>{item.productName}</p>
                  <p className="text-caption text-muted">
                    {[item.variantLabel, `Qty ${item.quantity}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-small tabular-nums">{money(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-6 flex flex-col gap-2 border-t border-line pt-4 text-small">
            <Row label="Subtotal" value={money(order.subtotal)} />
            {order.discountTotal > 0 && (
              <Row
                label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                value={`−${money(order.discountTotal)}`}
              />
            )}
            <Row
              label="Delivery"
              value={order.shippingTotal === 0 ? "Free" : money(order.shippingTotal)}
            />
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-body font-medium">
              <dt>Total (cash on delivery)</dt>
              <dd className="tabular-nums">{money(order.total)}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="address-heading" className="mt-10">
          <h2 id="address-heading" className="label-caps">
            Delivering to
          </h2>
          <address className="mt-3 text-small text-muted not-italic">
            {address.fullName}
            <br />
            {address.line1}
            {address.line2 && (
              <>
                <br />
                {address.line2}
              </>
            )}
            <br />
            {address.city}, {address.region}
          </address>
        </section>

        <p className="mt-10 text-small text-muted">
          {order.email ? `A receipt is on its way to ${order.email}. ` : ""}
          Keep this page’s link to check on your order later.
        </p>

        <Link to="/shop" className={buttonClassName({ variant: "secondary", className: "mt-8" })}>
          Continue shopping
        </Link>
      </div>
    </main>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="label-caps text-muted tabular-nums">0{number}</span>
      <div>
        <p className="text-small font-medium">{title}</p>
        <p className="mt-1 text-small text-muted">{children}</p>
      </div>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
