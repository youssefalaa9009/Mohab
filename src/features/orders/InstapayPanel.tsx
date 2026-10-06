import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { RequestError, send } from "@/features/account/api";
import { TextInput } from "@/features/account/AuthPages";
import type { OrderSummary } from "@/features/checkout/schema";
import { useHydrated } from "@/hooks/useHydrated";
import { formatMoney } from "@/lib/money";

// Cairo time on server and browser alike, so the rendered text never mismatches on hydration.
const DEADLINE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Payment step for InstaPay orders: where to send the money and a form for
 * the transfer reference. `submitPath` is the endpoint allowed to record it
 * (confirmation link or account); without it the panel is read-only.
 */
export function InstapayPanel({
  order,
  submitPath,
  extraBody,
  onUpdated,
}: {
  order: OrderSummary;
  submitPath?: string;
  /** Sent with the reference, e.g. the confirmation link's key. */
  extraBody?: Record<string, string>;
  onUpdated?: (order: OrderSummary) => void;
}) {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const instapay = order.instapay;
  if (!instapay) return null;

  const due = formatMoney({ amount: order.total, currency: order.currency });
  const deadline = DEADLINE.format(
    new Date(new Date(order.placedAt).getTime() + instapay.holdHours * 3_600_000),
  );
  const waiting = order.status === "pending_payment";
  const canSubmit =
    waiting && ["unpaid", "failed"].includes(order.paymentStatus) && Boolean(submitPath);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reference = String(new FormData(event.currentTarget).get("reference") ?? "");
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    try {
      const updated = await send<OrderSummary>(submitPath!, { reference, ...extraBody });
      onUpdated?.(updated);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      if (problem instanceof RequestError) setFieldError(problem.fields.reference);
    } finally {
      setBusy(false);
    }
  };

  if (order.paymentStatus === "paid") {
    return (
      <section className="border border-line bg-surface p-6" aria-labelledby="instapay-heading">
        <h2 id="instapay-heading" className="label-caps">
          Payment
        </h2>
        <p className="mt-3">InstaPay payment of {due} received. Thank you.</p>
      </section>
    );
  }

  return (
    <section className="border border-ink bg-surface p-6" aria-labelledby="instapay-heading">
      <h2 id="instapay-heading" className="label-caps">
        Pay with InstaPay
      </h2>

      {order.paymentStatus === "awaiting_verification" ? (
        <p role="status" className="mt-3">
          Thank you — we’re checking your transfer
          {instapay.reference && (
            <>
              {" "}
              (reference <span className="font-medium tabular-nums">{instapay.reference}</span>)
            </>
          )}
          . We’ll confirm your order as soon as it’s verified.
        </p>
      ) : waiting ? (
        <>
          {order.paymentStatus === "failed" && (
            <p role="alert" className="mt-3 text-danger">
              We couldn’t verify the last reference. Please check it in your banking app and send it
              again.
            </p>
          )}
          <ol className="mt-4 flex list-decimal flex-col gap-3 ps-5">
            <li>
              Send <strong className="tabular-nums">{due}</strong> by InstaPay to:
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
                <dt className="text-muted">Address</dt>
                <dd className="font-medium break-all">{instapay.address}</dd>
                <dt className="text-muted">Name</dt>
                <dd>{instapay.accountName}</dd>
              </dl>
            </li>
            <li>
              Add your order number <strong>{order.number}</strong> to the transfer note if your app
              allows it.
            </li>
            <li>Enter the transaction reference your banking app shows.</li>
          </ol>
          <p className="mt-4 text-small">
            Please pay by <strong>{deadline}</strong>. After that the order is cancelled and the
            items are released.
          </p>
          {instapay.note && <p className="mt-4 text-small text-muted">{instapay.note}</p>}

          {canSubmit ? (
            <form onSubmit={submit} method="post" noValidate className="mt-6 flex flex-col gap-4">
              {error && (
                <p role="alert" className="text-small text-danger">
                  {error}
                </p>
              )}
              <TextInput
                name="reference"
                label="Transaction reference"
                autoComplete="off"
                error={fieldError}
                disabled={!hydrated}
              />
              <Button type="submit" loading={busy} disabled={!hydrated} className="self-start">
                Send reference
              </Button>
            </form>
          ) : (
            <p className="mt-6 text-small text-muted">
              Use the link in your order email to send the reference.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
