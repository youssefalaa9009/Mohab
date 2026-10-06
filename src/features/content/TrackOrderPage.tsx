import { useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/Button";
import { RequestError, send } from "@/features/account/api";
import { TextInput } from "@/features/account/AuthPages";
import type { OrderSummary } from "@/features/checkout/schema";
import { InstapayPanel } from "@/features/orders/InstapayPanel";
import { OrderDetails } from "@/features/orders/OrderDetails";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import { ContentShell } from "./ContentShell";

/** What each status means for the customer, in their words. */
const STATUS_TEXT: Record<string, { title: string; detail: string }> = {
  awaiting_confirmation: {
    title: "Order received",
    detail: "We’ll call you to confirm it before it ships.",
  },
  pending_payment: {
    title: "Awaiting payment",
    detail: "Your order is confirmed once your InstaPay transfer is verified.",
  },
  confirmed: { title: "Confirmed", detail: "Your order is confirmed and being prepared." },
  processing: { title: "Being prepared", detail: "We’re getting your order ready to ship." },
  shipped: { title: "On its way", detail: "Your order is out for delivery." },
  delivered: { title: "Delivered", detail: "Your order has been delivered." },
  cancelled: { title: "Cancelled", detail: "This order was cancelled." },
  returned: { title: "Returned", detail: "This order was returned." },
};

const STEPS = ["awaiting_confirmation", "confirmed", "shipped", "delivered"] as const;
const STEP_LABELS = ["Placed", "Confirmed", "Shipped", "Delivered"];
/** processing sits between confirmed and shipped; pending_payment before confirmation. */
const STEP_INDEX: Record<string, number> = {
  awaiting_confirmation: 0,
  pending_payment: 0,
  confirmed: 1,
  processing: 1,
  shipped: 2,
  delivered: 3,
};

export function TrackOrderPage() {
  const hydrated = useHydrated();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const found = await send<OrderSummary>("/api/orders/track", {
        number: data.get("number"),
        phone: data.get("phone"),
      });
      setOrder(found);
      // Move focus to the result so keyboard and screen-reader users land on it.
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (problem) {
      setOrder(null);
      setError(problem instanceof RequestError ? problem.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const status = order ? (STATUS_TEXT[order.status] ?? STATUS_TEXT.awaiting_confirmation!) : null;
  const step = order ? STEP_INDEX[order.status] : undefined;

  return (
    <ContentShell
      title="Track order"
      eyebrow="Help"
      description="Check the status of your QUATTRO order with its number and your mobile number."
      intro={
        <>
          Your order number is in your confirmation (it starts with Q-).{" "}
          <Link to="/account/orders" className="text-ink underline">
            Signed in?
          </Link>{" "}
          Your orders are in your account.
        </>
      }
    >
      <form onSubmit={submit} method="post" noValidate className="flex max-w-md flex-col gap-5">
        {error && (
          <p role="alert" className="border border-danger px-4 py-3 text-small text-danger">
            {error}
          </p>
        )}
        <TextInput
          name="number"
          label="Order number"
          defaultValue={params.get("number")?.slice(0, 20)}
          disabled={!hydrated}
        />
        <TextInput
          name="phone"
          label="Mobile number"
          type="tel"
          autoComplete="tel"
          hint="The number you ordered with."
          disabled={!hydrated}
        />
        <Button type="submit" loading={busy} disabled={!hydrated} className="self-start">
          Track order
        </Button>
      </form>

      {order && status && (
        <div
          ref={resultRef}
          tabIndex={-1}
          aria-labelledby="track-result"
          className="mt-16 border-t border-line pt-10 focus:outline-none"
        >
          <p className="label-caps text-muted">Order {order.number}</p>
          <h2 id="track-result" className="mt-3 font-display text-h2">
            {status.title}
          </h2>
          <p className="mt-2 text-muted">{status.detail}</p>

          {step !== undefined && (
            <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Progress">
              {STEPS.map((key, index) => (
                <li key={key} className="flex flex-col gap-2">
                  <span
                    className={cn("h-0.5", index <= step ? "bg-ink" : "bg-line-strong")}
                    aria-hidden
                  />
                  <span
                    className={cn("text-caption", index <= step ? "text-ink" : "text-muted")}
                    aria-current={index === step ? "step" : undefined}
                  >
                    {STEP_LABELS[index]}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {order.instapay && (
            <div className="mt-10">
              <InstapayPanel order={order} />
            </div>
          )}
          <div className="mt-10">
            <OrderDetails order={order} />
          </div>
        </div>
      )}
    </ContentShell>
  );
}
