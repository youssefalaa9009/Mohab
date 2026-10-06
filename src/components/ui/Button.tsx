import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

const base =
  "label-caps relative inline-flex select-none items-center justify-center gap-2 " +
  "border transition-colors duration-200 ease-[var(--ease-out-expo)] " +
  "disabled:pointer-events-none disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  primary: "border-ink bg-ink text-paper hover:bg-ink-soft",
  secondary: "border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
  ghost: "border-transparent bg-transparent text-ink hover:border-line",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-12 px-6",
  lg: "h-14 px-8",
};

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction without changing the button's width. */
  loading?: boolean;
  children?: ReactNode;
  className?: string;
};

export type ButtonProps = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof ButtonOwnProps>;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      // OR, not ??: an explicit disabled={false} must not re-enable a loading button.
      disabled={Boolean(disabled) || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {/* Label keeps its space while loading, so the button never resizes. */}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
        {children}
      </span>
      {loading && <Spinner className="absolute" />}
    </button>
  );
}

/** Button styling applied to another element — typically a router <Link>. */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: Pick<ButtonOwnProps, "variant" | "size" | "className"> = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
