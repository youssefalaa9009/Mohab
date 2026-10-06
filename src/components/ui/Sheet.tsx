import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  side?: "left" | "right";
  children: ReactNode;
  /** Pinned below the scrolling body — primary actions live here. */
  footer?: ReactNode;
};

/**
 * Full-height side panel (filters, bag). Swipe toward its edge to dismiss.
 * The swipe offset arrives as CSS variables, so the gesture never re-renders React.
 */
export function Sheet({ open, onOpenChange, title, side = "right", children, footer }: SheetProps) {
  const fromRight = side === "right";
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection={side}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 min-h-dvh bg-ink/30 opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-500 ease-[var(--ease-drawer)] data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute" />
        <Drawer.Viewport
          className={cn("fixed inset-0 flex", fromRight ? "justify-end" : "justify-start")}
        >
          <Drawer.Popup
            className={cn(
              "flex h-full w-[min(28rem,100vw)] flex-col bg-canvas text-ink outline-none",
              "[transform:translateX(var(--drawer-swipe-movement-x))] transition-transform duration-500 ease-[var(--ease-drawer)] motion-reduce:transition-none",
              fromRight
                ? "data-ending-style:[transform:translateX(100%)] data-starting-style:[transform:translateX(100%)]"
                : "data-ending-style:[transform:translateX(-100%)] data-starting-style:[transform:translateX(-100%)]",
            )}
          >
            <div className="flex items-center justify-between border-b border-line px-gutter py-4">
              <Drawer.Title className="label-caps">{title}</Drawer.Title>
              <Drawer.Close
                aria-label="Close"
                className="-me-2 inline-flex size-11 items-center justify-center"
              >
                <X aria-hidden className="size-5" />
              </Drawer.Close>
            </div>
            <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter py-6">
              {children}
            </Drawer.Content>
            {footer && <div className="border-t border-line px-gutter py-4">{footer}</div>}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
