import { Field as BaseField } from "@base-ui/react/field";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Labelled form control. The label is always visible — placeholder-only fields
 * disappear once typing starts and fail WCAG 3.3.2.
 * Base UI wires label, description and error to the control for screen readers.
 */
export function Field({
  label,
  description,
  className,
  children,
  ...props
}: {
  label: string;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<typeof BaseField.Root>, "children" | "className">) {
  return (
    <BaseField.Root className={cn("flex flex-col gap-2", className)} {...props}>
      <BaseField.Label className="label-caps text-muted">{label}</BaseField.Label>
      {children}
      {description && (
        <BaseField.Description className="text-caption text-muted">
          {description}
        </BaseField.Description>
      )}
      <BaseField.Error className="text-caption text-danger" />
    </BaseField.Root>
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<typeof BaseField.Control>) {
  return (
    <BaseField.Control
      className={cn(
        "h-12 w-full rounded-input border border-line-strong bg-surface px-4 text-body",
        "placeholder:text-muted/70",
        "transition-colors duration-200 focus:border-ink focus:outline-none",
        "data-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  rows = 5,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseField.Control> & { rows?: number }) {
  return (
    <BaseField.Control
      // `render` swaps the underlying element while keeping Base UI's field wiring.
      render={<textarea rows={rows} />}
      className={cn(
        "w-full resize-y rounded-input border border-line-strong bg-surface px-4 py-3 text-body",
        "placeholder:text-muted/70",
        "transition-colors duration-200 focus:border-ink focus:outline-none",
        "data-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
