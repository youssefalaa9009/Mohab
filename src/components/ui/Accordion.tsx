import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { Plus } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Used for product details, FAQs and filter groups. */
export function Accordion({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseAccordion.Root>) {
  return <BaseAccordion.Root className={cn("border-t border-line", className)} {...props} />;
}

export function AccordionItem({
  title,
  children,
  className,
  ...props
}: { title: ReactNode; children: ReactNode; className?: string } & Omit<
  ComponentPropsWithoutRef<typeof BaseAccordion.Item>,
  "children" | "title"
>) {
  return (
    <BaseAccordion.Item className={cn("border-b border-line", className)} {...props}>
      <BaseAccordion.Header>
        <BaseAccordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-start label-caps transition-colors hover:text-muted">
          {title}
          <Plus
            aria-hidden
            className="size-4 shrink-0 transition-transform duration-300 ease-[var(--ease-out-expo)] group-data-panel-open:rotate-45"
          />
        </BaseAccordion.Trigger>
      </BaseAccordion.Header>
      {/* Base UI exposes the measured height so the panel can animate open. */}
      <BaseAccordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-300 ease-[var(--ease-out-expo)] data-ending-style:h-0 data-starting-style:h-0">
        <div className="pb-6 text-body text-muted">{children}</div>
      </BaseAccordion.Panel>
    </BaseAccordion.Item>
  );
}
