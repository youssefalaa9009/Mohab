import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { products, variants } from "./catalog";
import {
  cartStatus,
  inventoryReason,
  couponType,
  currency,
  orderEventKind,
  orderStatus,
  paymentMethod,
  paymentState,
  paymentStatus,
  timestamps,
} from "./shared";

/* ─── Customer data ──────────────────────────────────────────────────────── */

export const addresses = pgTable(
  "addresses",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text(),
    fullName: text().notNull(),
    phone: text().notNull(),
    line1: text().notNull(),
    line2: text(),
    city: text().notNull(),
    /** Governorate in Egypt; state/province elsewhere. */
    region: text().notNull(),
    postalCode: text(),
    countryCode: char({ length: 2 }).default("EG").notNull(),
    isDefaultShipping: boolean().default(false).notNull(),
    isDefaultBilling: boolean().default(false).notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

/* ─── Pricing rules ──────────────────────────────────────────────────────── */

/** Rates are business data supplied by QUATTRO — none are seeded as real values. */
export const shippingRates = pgTable("shipping_rates", {
  id: uuid().primaryKey().defaultRandom(),
  countryCode: char({ length: 2 }).default("EG").notNull(),
  /** Null = applies to every region in the country. */
  region: text(),
  name: text().notNull(),
  price: integer().notNull(),
  currency: currency(),
  freeOver: integer(),
  etaMinDays: integer(),
  etaMaxDays: integer(),
  isActive: boolean().default(true).notNull(),
  position: integer().default(0).notNull(),
  ...timestamps,
});

export const coupons = pgTable(
  "coupons",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Stored upper-case; lookups normalise input the same way. */
    code: text().notNull().unique(),
    type: couponType().notNull(),
    /** Percent (1–100) for `percent`; minor units for `fixed`; ignored for `free_shipping`. */
    value: integer().default(0).notNull(),
    minSubtotal: integer(),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    usageLimit: integer(),
    perCustomerLimit: integer(),
    timesUsed: integer().default(0).notNull(),
    isActive: boolean().default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    check("coupons_code_upper", sql`${t.code} = upper(${t.code})`),
    check(
      "coupons_percent_range",
      sql`${t.type} <> 'percent' OR (${t.value} BETWEEN 1 AND 100)`,
    ),
  ],
);

/* ─── Cart (server-side, identified by a hashed httpOnly cookie token) ───── */

export const carts = pgTable(
  "carts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().references(() => user.id, { onDelete: "set null" }),
    tokenHash: text().notNull().unique(),
    currency: currency(),
    couponId: uuid().references(() => coupons.id, { onDelete: "set null" }),
    status: cartStatus().default("active").notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.userId), index().on(t.status, t.updatedAt)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    cartId: uuid()
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid()
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    quantity: integer().notNull(),
    addedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.cartId, t.variantId),
    check("cart_items_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

/* ─── Orders ─────────────────────────────────────────────────────────────── */

export type AddressSnapshot = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode?: string | null;
  countryCode: string;
};

export type ShippingRateSnapshot = {
  id: string;
  name: string;
  price: number;
  etaMinDays?: number | null;
  etaMaxDays?: number | null;
};

export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 10001 });

export const orders = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Human-facing reference, e.g. Q-10001. */
    number: text()
      .notNull()
      .unique()
      .default(sql`'Q-' || nextval('order_number_seq')`),
    userId: text().references(() => user.id, { onDelete: "set null" }),
    email: text().notNull(),
    phone: text().notNull(),
    status: orderStatus().notNull(),
    paymentStatus: paymentStatus().default("unpaid").notNull(),
    paymentMethod: paymentMethod().notNull(),
    currency: currency(),
    subtotal: integer().notNull(),
    discountTotal: integer().default(0).notNull(),
    shippingTotal: integer().default(0).notNull(),
    taxTotal: integer().default(0).notNull(),
    total: integer().notNull(),
    couponCode: text(),
    shippingAddress: jsonb().$type<AddressSnapshot>().notNull(),
    billingAddress: jsonb().$type<AddressSnapshot>(),
    shippingRate: jsonb().$type<ShippingRateSnapshot>(),
    customerNote: text(),
    /** COD confirmation workflow. */
    confirmationAttempts: integer().default(0).notNull(),
    lastContactedAt: timestamp({ withTimezone: true }),
    /** Stock is held until this time for unconfirmed/unpaid orders, then released by cron. */
    reservedUntil: timestamp({ withTimezone: true }),
    placedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [
    index().on(t.status, t.placedAt),
    index().on(t.userId),
    index().on(t.phone),
    index().on(t.reservedUntil),
    check("orders_totals_nonnegative", sql`${t.total} >= 0 AND ${t.subtotal} >= 0`),
  ],
);

/** Snapshot of each line at purchase time — later catalog edits never change past orders. */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid().references(() => variants.id, { onDelete: "set null" }),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    productName: text().notNull(),
    variantLabel: text(),
    sku: text().notNull(),
    imageKey: text(),
    unitPrice: integer().notNull(),
    quantity: integer().notNull(),
    lineTotal: integer().notNull(),
  },
  (t) => [
    index().on(t.orderId),
    index().on(t.productId),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

/** Order timeline: status changes, payment updates, confirmation calls, staff notes. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: orderEventKind().notNull(),
    fromStatus: orderStatus(),
    toStatus: orderStatus(),
    note: text(),
    actorId: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index().on(t.orderId, t.createdAt)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** "cod", "instapay", or a gateway id such as "paymob". */
    provider: text().notNull(),
    /** Gateway transaction id or customer-submitted transfer reference. */
    providerRef: text(),
    method: paymentMethod().notNull(),
    state: paymentState().default("pending").notNull(),
    amount: integer().notNull(),
    currency: currency(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    index().on(t.orderId),
    // Webhook idempotency: the same gateway event can never be recorded twice.
    unique().on(t.provider, t.providerRef),
  ],
);

/** Append-only stock ledger. `variants.stock` is the running balance. */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid().primaryKey().defaultRandom(),
    variantId: uuid()
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    delta: integer().notNull(),
    reason: inventoryReason().notNull(),
    orderId: uuid().references(() => orders.id, { onDelete: "set null" }),
    actorId: text().references(() => user.id, { onDelete: "set null" }),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index().on(t.variantId, t.createdAt), index().on(t.orderId)],
);
