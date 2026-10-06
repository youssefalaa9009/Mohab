import { timingSafeEqual } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { FastifyRequest } from "fastify";
import type {
  CheckoutData,
  OrderSummary,
  ShippingOption,
} from "../../src/features/checkout/schema.js";
import { findCart, priceCart } from "../cart/service.js";
import { claimCouponUse, evaluateCoupon } from "../commerce/coupons.js";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";
import { isUniqueViolation } from "../db/errors.js";
import { instapayDetails } from "../payments/settings.js";
import { hashToken, newToken } from "../http/security.js";

/** Unconfirmed or unpaid orders one phone number may have open at once. */
const MAX_OPEN_ORDERS_PER_PHONE = 3;

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status = 409,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/* ─── Delivery options ────────────────────────────────────────────────────── */

type RateRow = typeof s.shippingRates.$inferSelect;

function toOption(rate: RateRow, subtotal: number, freeShipping: boolean): ShippingOption {
  const free = freeShipping || (rate.freeOver !== null && subtotal >= rate.freeOver);
  return {
    id: rate.id,
    name: rate.name,
    price: free ? 0 : rate.price,
    basePrice: rate.price,
    currency: rate.currency,
    etaMinDays: rate.etaMinDays,
    etaMaxDays: rate.etaMaxDays,
  };
}

/** Active rates covering a governorate: region-specific ones and country-wide ones (region null). */
async function ratesFor(governorate: string) {
  return db()
    .select()
    .from(s.shippingRates)
    .where(
      and(
        eq(s.shippingRates.isActive, true),
        eq(s.shippingRates.countryCode, "EG"),
        or(isNull(s.shippingRates.region), eq(s.shippingRates.region, governorate)),
      ),
    )
    .orderBy(asc(s.shippingRates.position), asc(s.shippingRates.price));
}

export async function shippingOptions(request: FastifyRequest, governorate: string) {
  const priced = await priceCart(await findCart(request));
  const subtotal = priced.view.subtotal.amount - priced.view.discount.amount;
  const rates = await ratesFor(governorate);
  return rates.map((rate) => toOption(rate, subtotal, priced.freeShipping));
}

/* ─── Placing an order ────────────────────────────────────────────────────── */

export type PlacedOrder = { orderId: string; number: string; accessKey: string };

export async function placeOrder(
  request: FastifyRequest,
  data: CheckoutData,
  /** Signed-in shopper: the order joins their history (never matched by email). */
  userId: string | null = null,
): Promise<PlacedOrder> {
  const cart = await findCart(request);
  if (!cart) throw new CheckoutError("Your bag is empty.", 422);

  // Abuse guard before any locking: unconfirmed orders are a cost (every one is a phone call).
  const [open] = await db()
    .select({ total: count() })
    .from(s.orders)
    .where(
      and(
        eq(s.orders.phone, data.phone),
        inArray(s.orders.status, ["awaiting_confirmation", "pending_payment"]),
      ),
    );
  if ((open?.total ?? 0) >= MAX_OPEN_ORDERS_PER_PHONE) {
    throw new CheckoutError(
      "You already have orders waiting for our confirmation call. We’ll be in touch shortly — please wait for that call before ordering again.",
      429,
    );
  }

  const instapay = data.paymentMethod === "instapay";
  if (instapay && !(await instapayDetails())) {
    throw new CheckoutError(
      "InstaPay isn’t available right now. Please choose cash on delivery.",
      400,
      {
        paymentMethod: "Choose another payment method.",
      },
    );
  }
  // COD orders wait for a confirmation call; InstaPay orders wait for the transfer.
  const initialStatus = instapay ? "pending_payment" : "awaiting_confirmation";

  const accessKey = newToken();

  const order = await db().transaction(async (tx) => {
    // Lock the variant rows so stock can't be sold twice by concurrent checkouts.
    const lines = await tx
      .select({
        quantity: s.cartItems.quantity,
        variant: s.variants,
        product: {
          id: s.products.id,
          name: s.products.name,
          status: s.products.status,
          publishedAt: s.products.publishedAt,
        },
        colorName: s.productColors.name,
      })
      .from(s.cartItems)
      .innerJoin(s.variants, eq(s.cartItems.variantId, s.variants.id))
      .innerJoin(s.products, eq(s.variants.productId, s.products.id))
      .leftJoin(s.productColors, eq(s.variants.colorId, s.productColors.id))
      .where(eq(s.cartItems.cartId, cart.id))
      .orderBy(asc(s.cartItems.addedAt))
      .for("update", { of: s.variants });

    if (!lines.length) throw new CheckoutError("Your bag is empty.", 422);

    const now = Date.now();
    const problems: string[] = [];
    for (const line of lines) {
      const live =
        line.variant.isActive &&
        line.product.status === "active" &&
        line.product.publishedAt !== null &&
        line.product.publishedAt.getTime() <= now;
      if (!live) problems.push(`${line.product.name} is no longer available.`);
      else if (line.variant.stock < line.quantity) {
        problems.push(
          line.variant.stock === 0
            ? `${line.product.name} has just sold out.`
            : `Only ${line.variant.stock} of ${line.product.name} left.`,
        );
      }
    }
    if (problems.length) {
      throw new CheckoutError(`${problems.join(" ")} Please review your bag.`, 409);
    }

    const currency = lines[0]!.variant.currency;
    const subtotal = lines.reduce((sum, line) => sum + line.variant.price * line.quantity, 0);

    // Re-evaluate the code against the final subtotal and claim one use atomically.
    let discount = 0;
    let freeShipping = false;
    let couponCode: string | null = null;
    if (cart.couponId) {
      const [coupon] = await tx
        .select()
        .from(s.coupons)
        .where(eq(s.coupons.id, cart.couponId))
        .limit(1);
      const outcome = evaluateCoupon(coupon ?? null, subtotal);
      if (!outcome.ok) {
        throw new CheckoutError(`Your code no longer applies: ${outcome.reason}`, 409);
      }
      if (outcome.coupon.perCustomerLimit !== null) {
        const [used] = await tx
          .select({ total: count() })
          .from(s.orders)
          .where(
            and(
              eq(s.orders.couponCode, outcome.coupon.code),
              eq(s.orders.phone, data.phone),
              ne(s.orders.status, "cancelled"),
            ),
          );
        if ((used?.total ?? 0) >= outcome.coupon.perCustomerLimit) {
          throw new CheckoutError(
            "You’ve already used this code the maximum number of times.",
            409,
          );
        }
      }
      if (!(await claimCouponUse(tx, outcome.coupon.id))) {
        throw new CheckoutError("This code has just reached its usage limit.", 409);
      }
      discount = outcome.discount;
      freeShipping = outcome.freeShipping;
      couponCode = outcome.coupon.code;
    }

    const [rate] = (await ratesFor(data.governorate)).filter(
      (row) => row.id === data.shippingRateId,
    );
    if (!rate) {
      throw new CheckoutError("That delivery option isn’t available for your governorate.", 400, {
        shippingRateId: "Choose a delivery option for your governorate.",
      });
    }
    const shipping = toOption(rate, subtotal - discount, freeShipping);
    const total = subtotal - discount + shipping.price;

    const productIds = [...new Set(lines.map((line) => line.product.id))];
    const images = await tx
      .select()
      .from(s.productImages)
      .where(inArray(s.productImages.productId, productIds))
      .orderBy(asc(s.productImages.position));
    const imageKeyFor = (productId: string, colorId: string | null) =>
      (
        images.find(
          (image) =>
            image.productId === productId && image.colorId === colorId && image.role === "primary",
        ) ?? images.find((image) => image.productId === productId)
      )?.key ?? null;

    const address = {
      fullName: data.fullName,
      phone: data.phone,
      line1: data.line1,
      line2: data.line2 ?? null,
      city: data.city,
      region: data.governorate,
      postalCode: null,
      countryCode: "EG",
    };

    const [created] = await tx
      .insert(s.orders)
      .values({
        userId,
        email: data.email,
        phone: data.phone,
        accessKeyHash: hashToken(accessKey),
        status: initialStatus,
        paymentStatus: "unpaid",
        paymentMethod: data.paymentMethod,
        currency,
        subtotal,
        discountTotal: discount,
        shippingTotal: shipping.price,
        total,
        couponCode,
        shippingAddress: address,
        shippingRate: {
          id: rate.id,
          name: rate.name,
          price: shipping.price,
          etaMinDays: rate.etaMinDays,
          etaMaxDays: rate.etaMaxDays,
        },
        customerNote: data.note ?? null,
      })
      .returning({ id: s.orders.id, number: s.orders.number });
    const orderId = created!.id;

    await tx.insert(s.orderItems).values(
      lines.map((line) => ({
        orderId,
        variantId: line.variant.id,
        productId: line.product.id,
        productName: line.product.name,
        variantLabel:
          [line.colorName, line.variant.size && `Size ${line.variant.size}`]
            .filter(Boolean)
            .join(" · ") || null,
        sku: line.variant.sku,
        imageKey: imageKeyFor(line.product.id, line.variant.colorId),
        unitPrice: line.variant.price,
        quantity: line.quantity,
        lineTotal: line.variant.price * line.quantity,
      })),
    );

    for (const line of lines) {
      await tx
        .update(s.variants)
        .set({ stock: sql`${s.variants.stock} - ${line.quantity}` })
        .where(eq(s.variants.id, line.variant.id));
    }
    await tx.insert(s.inventoryMovements).values(
      lines.map((line) => ({
        variantId: line.variant.id,
        delta: -line.quantity,
        reason: "order" as const,
        orderId,
      })),
    );

    await tx.insert(s.payments).values({
      orderId,
      provider: data.paymentMethod,
      method: data.paymentMethod,
      state: "pending",
      amount: total,
      currency,
    });
    await tx.insert(s.orderEvents).values({
      orderId,
      kind: "status_change",
      toStatus: initialStatus,
      note: instapay
        ? "Order placed online — InstaPay, waiting for the transfer."
        : "Order placed online — cash on delivery.",
    });

    await tx.update(s.carts).set({ status: "converted" }).where(eq(s.carts.id, cart.id));

    if (userId && data.saveAddress) {
      const [existing] = await tx
        .select({ total: count() })
        .from(s.addresses)
        .where(eq(s.addresses.userId, userId));
      await tx.insert(s.addresses).values({
        userId,
        fullName: data.fullName,
        phone: data.phone,
        region: data.governorate,
        city: data.city,
        line1: data.line1,
        line2: data.line2 ?? null,
        isDefaultShipping: (existing?.total ?? 0) === 0,
      });
    }
    return created!;
  });

  return { orderId: order.id, number: order.number, accessKey };
}

/* ─── Reading an order back ───────────────────────────────────────────────── */

export async function orderSummary(orderId: string): Promise<OrderSummary | null> {
  const [order] = await db().select().from(s.orders).where(eq(s.orders.id, orderId)).limit(1);
  if (!order) return null;
  const items = await db()
    .select()
    .from(s.orderItems)
    .where(eq(s.orderItems.orderId, orderId))
    .orderBy(asc(s.orderItems.productName));

  return {
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    placedAt: order.placedAt.toISOString(),
    email: order.email,
    phone: order.phone,
    shippingAddress: order.shippingAddress,
    shippingRateName: order.shippingRate?.name ?? null,
    items: items.map((item) => ({
      productName: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      imageKey: item.imageKey,
    })),
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    total: order.total,
    currency: order.currency,
    couponCode: order.couponCode,
    instapay: order.paymentMethod === "instapay" ? await instapayFor(order.id) : null,
  };
}

/** Transfer details (current settings) plus the reference the customer submitted, if any. */
async function instapayFor(orderId: string) {
  const details = await instapayDetails();
  const [payment] = await db()
    .select({ ref: s.payments.providerRef })
    .from(s.payments)
    .where(and(eq(s.payments.orderId, orderId), eq(s.payments.provider, "instapay")))
    .orderBy(desc(s.payments.createdAt))
    .limit(1);
  return {
    address: details?.address ?? "",
    accountName: details?.accountName ?? "",
    note: details?.note ?? null,
    holdHours: details?.holdHours ?? 48,
    reference: payment?.ref ?? null,
  };
}

/* ─── InstaPay: the customer reports their transfer ───────────────────────── */

/** A transfer reference as banking apps show it: letters, digits and dashes. */
export const instapayReference = z
  .string()
  .trim()
  .min(4, "Enter the transaction reference from your banking app.")
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, "Use the reference exactly as your banking app shows it.");

/**
 * Record the transfer reference for an InstaPay order and queue it for staff
 * to check. Allowed while the order waits for payment and nothing is pending
 * verification already — a rejected reference can be replaced.
 */
export async function submitInstapayReference(orderId: string, reference: string) {
  return db().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(s.orders)
      .where(eq(s.orders.id, orderId))
      .for("update")
      .limit(1);
    if (!order || order.paymentMethod !== "instapay") {
      throw new CheckoutError("This order isn’t paid with InstaPay.", 400);
    }
    if (order.status !== "pending_payment" || !["unpaid", "failed"].includes(order.paymentStatus)) {
      throw new CheckoutError("This order isn’t waiting for a payment reference.", 409);
    }
    try {
      await tx
        .update(s.payments)
        .set({ providerRef: reference, state: "pending" })
        .where(and(eq(s.payments.orderId, order.id), eq(s.payments.provider, "instapay")));
    } catch (error) {
      // payments(provider, provider_ref) is unique: one transfer can't pay two orders.
      if (isUniqueViolation(error)) {
        throw new CheckoutError("This reference has already been used for another order.", 409, {
          reference: "Check the reference and try again.",
        });
      }
      throw error;
    }
    await tx
      .update(s.orders)
      .set({ paymentStatus: "awaiting_verification" })
      .where(eq(s.orders.id, order.id));
    await tx.insert(s.orderEvents).values({
      orderId: order.id,
      kind: "payment",
      note: `InstaPay reference submitted: ${reference}`,
    });
    return order;
  });
}

function sameHash(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The order id for a number and the secret from its confirmation link, or null. */
export async function orderIdByAccessKey(number: string, key: string) {
  const [order] = await db()
    .select({ id: s.orders.id, accessKeyHash: s.orders.accessKeyHash })
    .from(s.orders)
    .where(eq(s.orders.number, number))
    .limit(1);
  if (!order?.accessKeyHash || !sameHash(order.accessKeyHash, hashToken(key))) return null;
  return order.id;
}

/** Look up an order by number and the secret from its confirmation link. */
export async function orderByAccessKey(number: string, key: string) {
  const id = await orderIdByAccessKey(number, key);
  return id ? orderSummary(id) : null;
}

/** Order status for the "track your order" page: number plus the phone it was placed with. */
export async function orderByPhone(number: string, phone: string) {
  const [order] = await db()
    .select({ id: s.orders.id })
    .from(s.orders)
    .where(and(eq(s.orders.number, number), eq(s.orders.phone, phone)))
    .limit(1);
  return order ? orderSummary(order.id) : null;
}
