import { MessageCircle, Phone } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLoaderData, useRevalidator, type LoaderFunctionArgs } from "react-router";
import { Button } from "@/components/ui/Button";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import { adminGet, adminPost } from "./api";
import { displayPhone, egp, formatDateTime, whatsappHref } from "./format";
import { StatusBadge } from "./StatusBadge";
import { STATUS_LABELS, type AdminOrderDetail, type OrderStatus } from "./types";

export async function orderLoader(args: LoaderFunctionArgs) {
  return adminGet<AdminOrderDetail>(
    args,
    `/api/admin/orders/${encodeURIComponent(args.params.number!)}`,
  );
}

/** What the next-step button says for each transition. */
const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  processing: "Start packing",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered (cash collected)",
  returned: "Mark as returned",
  cancelled: "Cancel order",
};

export function OrderPage() {
  const order = useLoaderData() as AdminOrderDetail;
  const revalidator = useRevalidator();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  /** Run an action, then reload this page's data (and the sidebar's queue count). */
  const act = async (key: string, path: string, body: unknown) => {
    setBusy(key);
    setError(null);
    try {
      await adminPost(path, body);
      setNote("");
      await revalidator.revalidate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };
  const base = `/api/admin/orders/${order.number}`;
  const disabled = !hydrated || busy !== null;
  const cancellations = order.previousOrders.filter(
    (previous) => previous.status === "cancelled",
  ).length;

  const forward = order.allowedTransitions.filter((status) => status !== "cancelled");
  const canCancel = order.allowedTransitions.includes("cancelled");
  const awaiting = order.status === "awaiting_confirmation";
  const transfer = order.payments.find((payment) => payment.provider === "instapay");
  const verifying = order.paymentStatus === "awaiting_verification";

  return (
    <>
      <title>{`${order.number} · Admin · QUATTRO`}</title>
      <Link to="/admin/orders" className="link-underline label-caps text-muted">
        ← Orders
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-h1">{order.number}</h1>
        <StatusBadge status={order.status} />
        <span className="text-small text-muted">Placed {formatDateTime(order.placedAt)}</span>
      </div>

      {error && (
        <p role="alert" className="mb-6 border border-danger px-4 py-3 text-small text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-8">
          {order.paymentMethod === "instapay" && order.status === "pending_payment" && (
            <Panel title="InstaPay payment" tone="warning">
              {verifying ? (
                <>
                  <p className="text-small">
                    The customer reports a transfer of{" "}
                    <strong className="tabular-nums">{egp(order.total)}</strong> with reference{" "}
                    <strong className="tabular-nums">{transfer?.reference}</strong>. Check your
                    banking app before verifying.
                  </p>
                  <label className="mt-5 flex flex-col gap-2">
                    <span className="label-caps text-muted">Note (optional)</span>
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      disabled={disabled}
                      className="h-11 rounded-input border border-line-strong bg-canvas px-3 text-small focus:border-ink focus:outline-none"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      disabled={disabled}
                      loading={busy === "approve"}
                      onClick={() =>
                        act("approve", `${base}/payment`, { decision: "approve", note })
                      }
                    >
                      Payment received
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={disabled}
                      loading={busy === "reject"}
                      onClick={() => act("reject", `${base}/payment`, { decision: "reject", note })}
                    >
                      Not found
                    </Button>
                  </div>
                  <p className="mt-3 text-caption text-muted">
                    “Payment received” confirms the order. “Not found” asks the customer to check
                    and resend the reference.
                  </p>
                </>
              ) : (
                <p className="text-small text-muted">
                  {order.paymentStatus === "failed"
                    ? "The last reference couldn’t be verified. Waiting for the customer to send a new one."
                    : "Waiting for the customer to send the transfer and its reference."}{" "}
                  You can call {displayPhone(order.phone)} if it takes too long, or cancel the order
                  to release the stock.
                </p>
              )}
            </Panel>
          )}
          {awaiting && (
            <Panel title="Confirmation call" tone="warning">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`tel:${order.phone}`}
                  className="inline-flex h-12 items-center gap-2 bg-ink px-5 font-display text-h3 text-paper tabular-nums"
                >
                  <Phone aria-hidden className="size-4" />
                  {displayPhone(order.phone)}
                </a>
                <a
                  href={whatsappHref(order.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center gap-2 border border-ink px-4 text-small"
                >
                  <MessageCircle aria-hidden className="size-4" /> WhatsApp
                </a>
              </div>
              <p className="mt-4 text-small text-muted">
                {order.confirmationAttempts === 0
                  ? "Not called yet."
                  : `${order.confirmationAttempts} ${order.confirmationAttempts === 1 ? "call" : "calls"} so far${
                      order.lastContactedAt ? `, last ${formatDateTime(order.lastContactedAt)}` : ""
                    }.`}
                {order.previousOrders.length > 0 &&
                  ` This number has ${order.previousOrders.length} other ${
                    order.previousOrders.length === 1 ? "order" : "orders"
                  }${cancellations ? `, ${cancellations} cancelled` : ""}.`}
              </p>

              <label className="mt-5 flex flex-col gap-2">
                <span className="label-caps text-muted">Call note (optional)</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={disabled}
                  placeholder="e.g. prefers delivery after 6pm"
                  className="h-11 rounded-input border border-line-strong bg-canvas px-3 text-small focus:border-ink focus:outline-none"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={disabled}
                  loading={busy === "confirmed"}
                  onClick={() =>
                    act("confirmed", `${base}/contact`, { outcome: "confirmed", note })
                  }
                >
                  Confirmed
                </Button>
                <Button
                  variant="secondary"
                  disabled={disabled}
                  loading={busy === "no_answer"}
                  onClick={() =>
                    act("no_answer", `${base}/contact`, { outcome: "no_answer", note })
                  }
                >
                  No answer
                </Button>
                <Button
                  variant="ghost"
                  disabled={disabled}
                  loading={busy === "cancel-call"}
                  className="text-danger"
                  onClick={() => {
                    if (window.confirm(`Cancel ${order.number}? Its stock goes back on sale.`)) {
                      void act("cancel-call", `${base}/contact`, { outcome: "cancelled", note });
                    }
                  }}
                >
                  Customer cancelled
                </Button>
              </div>
            </Panel>
          )}

          {!awaiting && (forward.length > 0 || canCancel) && (
            <Panel title="Next step">
              <div className="flex flex-wrap gap-2">
                {forward.map((status) => (
                  <Button
                    key={status}
                    disabled={disabled}
                    loading={busy === status}
                    onClick={() => act(status, `${base}/status`, { to: status })}
                  >
                    {ACTION_LABELS[status] ?? STATUS_LABELS[status]}
                  </Button>
                ))}
                {canCancel && (
                  <Button
                    variant="ghost"
                    className="text-danger"
                    disabled={disabled}
                    loading={busy === "cancelled"}
                    onClick={() => {
                      if (window.confirm(`Cancel ${order.number}? Its stock goes back on sale.`)) {
                        void act("cancelled", `${base}/status`, { to: "cancelled" });
                      }
                    }}
                  >
                    Cancel order
                  </Button>
                )}
              </div>
            </Panel>
          )}

          <Panel title={`Items (${order.items.reduce((sum, item) => sum + item.quantity, 0)})`}>
            <ul className="flex flex-col divide-y divide-line">
              {order.items.map((item, index) => (
                <li key={index} className="flex gap-4 py-3 first:pt-0">
                  <div className="w-14 shrink-0">
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
                    {item.productId ? (
                      <Link to={`/admin/products/${item.productId}`} className="hover:underline">
                        {item.productName}
                      </Link>
                    ) : (
                      item.productName
                    )}
                    <p className="text-caption text-muted">
                      {[item.variantLabel, item.sku].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-end text-small tabular-nums">
                    {item.quantity} × {egp(item.unitPrice, order.currency)}
                    <p className="font-medium">{egp(item.lineTotal, order.currency)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-4 flex flex-col gap-1 border-t border-line pt-4 text-small">
              <Row label="Subtotal" value={egp(order.subtotal, order.currency)} />
              {order.discountTotal > 0 && (
                <Row
                  label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                  value={`−${egp(order.discountTotal, order.currency)}`}
                />
              )}
              <Row
                label={`Delivery${order.shippingRate ? ` — ${order.shippingRate.name}` : ""}`}
                value={
                  order.shippingTotal === 0 ? "Free" : egp(order.shippingTotal, order.currency)
                }
              />
              <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium">
                <dt>Total to collect</dt>
                <dd className="tabular-nums">{egp(order.total, order.currency)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Timeline">
            <form
              method="post"
              onSubmit={(event) => {
                event.preventDefault();
                if (note.trim()) void act("note", `${base}/notes`, { note });
              }}
              className="mb-6 flex gap-2"
            >
              <label className="flex-1">
                <span className="sr-only">Add a staff note</span>
                <input
                  value={awaiting ? "" : note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={disabled || awaiting}
                  placeholder={awaiting ? "Use the call note above" : "Add a staff note"}
                  className="h-11 w-full rounded-input border border-line-strong bg-canvas px-3 text-small focus:border-ink focus:outline-none"
                />
              </label>
              <Button
                type="submit"
                variant="secondary"
                disabled={disabled || awaiting}
                loading={busy === "note"}
              >
                Add
              </Button>
            </form>
            <ol className="flex flex-col gap-4">
              {order.events.map((event, index) => (
                <li key={index} className="flex gap-3 text-small">
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" />
                  <div>
                    <p>{describeEvent(event)}</p>
                    <p className="text-caption text-muted">
                      {formatDateTime(event.createdAt)}
                      {event.actor ? ` · ${event.actor}` : " · Customer"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="flex flex-col gap-8">
          <Panel title="Customer">
            <p className="text-small">{order.shippingAddress.fullName}</p>
            <p className="text-small tabular-nums">
              <a href={`tel:${order.phone}`} className="hover:underline">
                {displayPhone(order.phone)}
              </a>
            </p>
            {order.email && (
              <p className="text-small">
                <a href={`mailto:${order.email}`} className="hover:underline">
                  {order.email}
                </a>
              </p>
            )}
          </Panel>
          <Panel title="Delivery address">
            <address className="text-small not-italic">
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
          </Panel>
          {order.customerNote && (
            <Panel title="Customer note" tone="warning">
              <p className="text-small whitespace-pre-line">{order.customerNote}</p>
            </Panel>
          )}
          <Panel title="Payment">
            <p className="text-small">
              {order.paymentMethod === "cod" ? "Cash on delivery" : "InstaPay"} —{" "}
              <span className={order.paymentStatus === "paid" ? "text-success" : "text-muted"}>
                {order.paymentStatus.replaceAll("_", " ")}
              </span>
            </p>
            {transfer?.reference && (
              <p className="mt-2 text-caption text-muted">
                Reference <span className="text-ink tabular-nums">{transfer.reference}</span>
              </p>
            )}
          </Panel>
          {order.previousOrders.length > 0 && (
            <Panel title="Other orders from this number">
              <ul className="flex flex-col gap-2 text-small">
                {order.previousOrders.map((previous) => (
                  <li key={previous.number} className="flex items-center justify-between gap-2">
                    <Link to={`/admin/orders/${previous.number}`} className="hover:underline">
                      {previous.number}
                    </Link>
                    <StatusBadge status={previous.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function describeEvent(event: AdminOrderDetail["events"][number]) {
  if (event.kind === "status_change" && event.toStatus) {
    const moved = event.fromStatus
      ? `${STATUS_LABELS[event.fromStatus]} → ${STATUS_LABELS[event.toStatus]}`
      : STATUS_LABELS[event.toStatus];
    return event.note ? `${moved}. ${event.note}` : moved;
  }
  return event.note ?? event.kind;
}

function Panel({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "warning";
  children: ReactNode;
}) {
  return (
    <section
      className={cn("border bg-surface p-6", tone === "warning" ? "border-warning" : "border-line")}
    >
      <h2 className="mb-4 label-caps">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
