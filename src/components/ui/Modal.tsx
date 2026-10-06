import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hide the title (it is still announced) — e.g. for an image lightbox. */
  hideTitle?: boolean;
  description?: string;
  size?: "md" | "lg" | "full";
  children: ReactNode;
  className?: string;
};

const sizes = {
  md: "w-[min(36rem,calc(100vw-2*var(--gutter)))] max-h-[85dvh]",
  lg: "w-[min(56rem,calc(100vw-2*var(--gutter)))] max-h-[85dvh]",
  full: "h-dvh w-screen",
};

/**
 * Centred dialog. Base UI traps focus, locks scroll, closes on Escape and
 * returns focus to the trigger; the transitions are opacity/transform only.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  description,
  size = "md",
  children,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 min-h-dvh bg-ink/40 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden bg-canvas text-ink outline-none",
            "transition-[opacity,scale] duration-300 ease-[var(--ease-out-expo)] data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            sizes[size],
            className,
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-4 px-6 pt-5",
              hideTitle && "absolute inset-x-0 top-0 z-10 px-4 pt-4",
            )}
          >
            <Dialog.Title className={cn("font-display text-h3", hideTitle && "sr-only")}>
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="ms-auto -me-2 inline-flex size-11 items-center justify-center bg-canvas/80"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="px-6 pt-1 text-small text-muted">
              {description}
            </Dialog.Description>
          )}
          <div
            className={cn("min-h-0 flex-1 overflow-y-auto", size !== "full" && "px-6 pt-4 pb-6")}
          >
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
