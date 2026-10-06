import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { EMPTY_CART, type CartMutationResult, type CartView } from "./types";

type Outcome = { ok: true; notice?: string | undefined } | { ok: false; error: string };

type CartApi = {
  cart: CartView;
  pending: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** Last success message for the drawer's live region ("Added to bag", stock notices…). */
  announcement: string;
  add: (
    variantId: string,
    quantity: number,
    options?: { openDrawer?: boolean },
  ) => Promise<Outcome>;
  update: (itemId: string, quantity: number) => Promise<Outcome>;
  remove: (itemId: string) => Promise<Outcome>;
  applyCoupon: (code: string) => Promise<Outcome>;
  removeCoupon: () => Promise<Outcome>;
  /** Re-read from the server, e.g. after checkout empties the bag. */
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartApi | null>(null);

async function send(method: string, path: string, body?: unknown): Promise<CartMutationResult> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<CartMutationResult> & {
    error?: string;
  };
  if (!response.ok || !data.cart) {
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }
  return data as CartMutationResult;
}

/**
 * Bag state for the whole storefront. Seeded from the server render (so the
 * header count is right on first paint) and replaced by each mutation's
 * response — the server prices every line, the client never does arithmetic.
 */
export function CartProvider({
  initial,
  children,
}: {
  initial: CartView | null;
  children: ReactNode;
}) {
  const [cart, setCart] = useState<CartView>(initial ?? EMPTY_CART);
  const [pending, setPending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const run = useCallback(
    async (request: () => Promise<CartMutationResult>, success: string): Promise<Outcome> => {
      setPending(true);
      try {
        const result = await request();
        setCart(result.cart);
        setAnnouncement(result.notice ?? success);
        return { ok: true, notice: result.notice };
      } catch (error) {
        // Not announced here: every caller shows the error inline with role="alert",
        // and announcing it twice makes screen readers read it twice.
        const message = error instanceof Error ? error.message : "Something went wrong.";
        return { ok: false, error: message };
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const api = useMemo<CartApi>(
    () => ({
      cart,
      pending,
      drawerOpen,
      setDrawerOpen,
      announcement,
      add: async (variantId, quantity, options = {}) => {
        const outcome = await run(
          () => send("POST", "/api/cart/items", { variantId, quantity }),
          "Added to your bag.",
        );
        if (outcome.ok) track("add_to_bag", { quantity });
        if (outcome.ok && options.openDrawer !== false) setDrawerOpen(true);
        return outcome;
      },
      update: (itemId, quantity) =>
        run(() => send("PATCH", `/api/cart/items/${itemId}`, { quantity }), "Bag updated."),
      remove: (itemId) =>
        run(() => send("DELETE", `/api/cart/items/${itemId}`), "Removed from your bag."),
      applyCoupon: (code) => run(() => send("POST", "/api/cart/coupon", { code }), "Code applied."),
      removeCoupon: () => run(() => send("DELETE", "/api/cart/coupon"), "Code removed."),
      refresh: async () => {
        const response = await fetch("/api/cart", { credentials: "same-origin" });
        if (response.ok) setCart((await response.json()) as CartView);
      },
    }),
    [cart, pending, drawerOpen, announcement, run],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const api = useContext(CartContext);
  if (!api) throw new Error("useCart must be used inside <CartProvider>");
  return api;
}
