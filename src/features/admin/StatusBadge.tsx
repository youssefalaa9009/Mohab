import { cn } from "@/lib/cn";
import { STATUS_LABELS, type OrderStatus } from "./types";

/** Colour plus text — never colour alone — so status reads without colour vision. */
const TONES: Record<OrderStatus, string> = {
  awaiting_confirmation: "border-warning text-warning",
  pending_payment: "border-warning text-warning",
  confirmed: "border-ink text-ink",
  processing: "border-ink text-ink",
  shipped: "border-ink bg-ink text-paper",
  delivered: "border-success bg-success text-paper",
  cancelled: "border-line-strong text-muted",
  returned: "border-line-strong text-muted",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center border px-2 label-caps whitespace-nowrap",
        TONES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
