/** Admin API contract. The server functions are annotated with these types. */

export const ORDER_STATUSES = [
  "awaiting_confirmation",
  "pending_payment",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Viewer = { id: string; name: string; email: string; role: "customer" | "admin" };

export type AdminOrderRow = {
  number: string;
  status: OrderStatus;
  paymentStatus: string;
  placedAt: string;
  phone: string;
  name: string;
  region: string;
  total: number;
  currency: string;
  attempts: number;
  itemCount: number;
};

export type AdminOrderList = {
  orders: AdminOrderRow[];
  total: number;
  page: number;
  pageCount: number;
  counts: Partial<Record<OrderStatus, number>>;
};

export type AdminOrderEvent = {
  kind: "status_change" | "payment" | "contact_attempt" | "note";
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  note: string | null;
  createdAt: string;
  actor: string | null;
};

export type AdminOrderDetail = {
  number: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  placedAt: string;
  email: string | null;
  phone: string;
  shippingAddress: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    region: string;
  };
  shippingRate: { name: string; price: number } | null;
  customerNote: string | null;
  confirmationAttempts: number;
  lastContactedAt: string | null;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  couponCode: string | null;
  allowedTransitions: OrderStatus[];
  items: {
    productName: string;
    variantLabel: string | null;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageKey: string | null;
    productId: string | null;
  }[];
  events: AdminOrderEvent[];
  payments: {
    provider: string;
    method: string;
    state: string;
    amount: number;
    reference: string | null;
  }[];
  previousOrders: { number: string; status: OrderStatus; placedAt: string }[];
};

export type AdminDashboard = {
  awaitingConfirmation: number;
  /** InstaPay transfers reported by customers, not yet checked. */
  paymentsToVerify: number;
  ordersToday: number;
  week: { orders: number; revenue: number; currency: string };
  lowStock: {
    variantId: string;
    sku: string;
    size: string | null;
    stock: number;
    productId: string;
    productName: string;
    colorName: string | null;
  }[];
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_confirmation: "Awaiting confirmation",
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

/* ─── Products ──────────────────────────────────────────────────────────── */

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type AdminImage = {
  id: string;
  key: string;
  alt: string;
  width: number;
  height: number;
  role: "primary" | "hover" | "gallery";
  position: number;
  colorId: string | null;
};

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  categoryName: string;
  image: AdminImage | null;
  minPrice: number | null;
  maxPrice: number | null;
  totalStock: number;
  variantCount: number;
  isDemo: boolean;
  updatedAt: string;
};

export type AdminProductList = {
  products: AdminProductRow[];
  total: number;
  page: number;
  pageCount: number;
};

export type AdminVariant = {
  id: string;
  colorId: string | null;
  size: string | null;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  isActive: boolean;
};

export type AdminProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  material: string | null;
  fit: string | null;
  care: string | null;
  tags: string[];
  categoryId: string;
  gender: "men" | "women" | "unisex";
  status: ProductStatus;
  isFeatured: boolean;
  merchRank: number;
  publishedAt: string | null;
  sizeChartId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isDemo: boolean;
  collectionIds: string[];
  colors: { id: string; name: string; hex: string | null; position: number }[];
  images: AdminImage[];
  variants: AdminVariant[];
  options: {
    categories: { id: string; name: string }[];
    collections: { id: string; name: string }[];
    sizeCharts: { id: string; name: string }[];
  };
};

export type StockMovement = {
  delta: number;
  reason: "order" | "restock" | "adjustment" | "return" | "release";
  note: string | null;
  orderNumber: string | null;
  actor: string | null;
  createdAt: string;
};

/* ─── Store settings ────────────────────────────────────────────────────── */

export type AdminCoupon = {
  id: string;
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  minSubtotal: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  timesUsed: number;
  isActive: boolean;
};

export type AdminShippingRate = {
  id: string;
  name: string;
  region: string | null;
  price: number;
  freeOver: number | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  isActive: boolean;
  position: number;
};

export type AdminTaxonomyItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  position: number;
  productCount: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type AdminCustomer = {
  phone: string;
  name: string;
  email: string | null;
  orders: number;
  /** Confirmed-or-later orders only: money that actually came in or is on its way. */
  spent: number;
  cancelled: number;
  lastOrderAt: string;
};
