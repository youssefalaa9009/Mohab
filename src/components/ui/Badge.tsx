import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "sale" | "soldOut";

const tones: Record<BadgeTone, string> = {
  neutral: "border-ink text-ink",
  sale: "border-danger text-danger",
  soldOut: "border-line-strong text-ink-soft",
};

/** Square, outlined marker — NEW / SALE / SOLD OUT. Never a coloured pill. */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        // Opaque, so text contrast never depends on the photo underneath.
        "inline-flex h-6 items-center border bg-canvas px-2 label-caps",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
