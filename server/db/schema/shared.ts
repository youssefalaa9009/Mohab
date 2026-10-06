import { char, pgEnum, timestamp } from "drizzle-orm/pg-core";

/** Timestamp columns every mutable table carries. */
export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/** ISO 4217 currency code. Amounts are always stored as integer minor units (piastres, cents). */
export const currency = () => char({ length: 3 }).default("EGP").notNull();

export const userRole = pgEnum("user_role", ["customer", "admin"]);
export const gender = pgEnum("gender", ["men", "women", "unisex"]);
export const productStatus = pgEnum("product_status", ["draft", "active", "archived"]);
export const imageRole = pgEnum("image_role", ["primary", "hover", "gallery"]);
export const sizeUnit = pgEnum("size_unit", ["cm", "in"]);
export const inventoryReason = pgEnum("inventory_reason", [
  "order",
  "restock",
  "adjustment",
  "return",
  "release",
]);
export const cartStatus = pgEnum("cart_status", ["active", "converted", "abandoned"]);
export const couponType = pgEnum("coupon_type", ["percent", "fixed", "free_shipping"]);

/**
 * Fulfilment lifecycle. COD orders start at `awaiting_confirmation` (admin phones the customer);
 * online payments start at `pending_payment`.
 */
export const orderStatus = pgEnum("order_status", [
  "awaiting_confirmation",
  "pending_payment",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
]);
export const paymentStatus = pgEnum("payment_status", [
  "unpaid",
  "awaiting_verification", // manual methods (InstaPay) — admin checks the bank app
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);
export const paymentMethod = pgEnum("payment_method", ["cod", "instapay", "card", "wallet"]);
export const paymentState = pgEnum("payment_state", ["pending", "succeeded", "failed", "refunded"]);
export const orderEventKind = pgEnum("order_event_kind", [
  "status_change",
  "payment",
  "contact_attempt",
  "note",
]);
export const subscriberStatus = pgEnum("subscriber_status", ["subscribed", "unsubscribed"]);
export const messageStatus = pgEnum("message_status", ["new", "handled"]);
