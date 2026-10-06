import type { ImageRef, Money, StockLevel } from "@/features/catalog/types";

export type CartLine = {
  id: string;
  variantId: string;
  productSlug: string;
  productName: string;
  colorName: string | null;
  colorSlug: string | null;
  size: string | null;
  image: ImageRef | null;
  unitPrice: Money;
  compareAtPrice: Money | null;
  quantity: number;
  lineTotal: Money;
  stock: StockLevel;
  /** Highest quantity the shopper may choose for this line right now. */
  maxQuantity: number;
  /** False when the variant was withdrawn or sold out after being added. */
  available: boolean;
};

export type AppliedCoupon = {
  code: string;
  /** Human summary, e.g. "10% off" or "Free delivery". */
  label: string;
  /** Set when the code no longer applies (e.g. the bag fell below its minimum). */
  problem: string | null;
  freeShipping: boolean;
};

export type CartView = {
  lines: CartLine[];
  itemCount: number;
  /** Sum of available lines only. */
  subtotal: Money;
  discount: Money;
  coupon: AppliedCoupon | null;
  /** Subtotal minus discount. Shipping is added at checkout. */
  total: Money;
  /** Lines that must be removed before checkout. */
  hasUnavailable: boolean;
};

export type CartMutationResult = {
  cart: CartView;
  /** Non-blocking information, e.g. a quantity reduced to the stock left. */
  notice?: string;
};

export const EMPTY_CART: CartView = {
  lines: [],
  itemCount: 0,
  subtotal: { amount: 0, currency: "EGP" },
  discount: { amount: 0, currency: "EGP" },
  coupon: null,
  total: { amount: 0, currency: "EGP" },
  hasUnavailable: false,
};

export const MAX_LINE_QUANTITY = 10;
