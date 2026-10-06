import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import type {
  AdminDashboard,
  AdminOrderDetail,
  AdminOrderList,
} from "../../src/features/admin/types.js";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";

export type OrderStatus = (typeof s.orderStatus.enumValues)[number];

/**
 * The COD lifecycle. Anything not listed is refused, so an order can never
 * jump from "awaiting confirmation" straight to "delivered".
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_confirmation: ["confirmed", "cancelled"],
  // Confirmed only through payment review (reviewPayment), never a bare status change.
  pending_payment: ["cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

/** States where stock is still held by the order and goes back on cancellation. */
const RESTOCK_ON_CANCEL = new Set<OrderStatus>([
  "awaiting_confirmation",
  "pending_payment",
  "confirmed",
  "processing",
]);

export class OrderActionError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

async function lockOrder(tx: Tx, number: string) {
  const [order] = await tx
    .select()
    .from(s.orders)
    .where(eq(s.orders.number, number))
    .for("update")
    .limit(1);
  if (!order) throw new OrderActionError("Order not found.", 404);
  return order;
}

/** `actorId` is the staff member, or null for automatic actions. */
async function returnStock(
  tx: Tx,
  orderId: string,
  reason: "release" | "return",
  actorId: string | null,
) {
  const items = await tx
    .select({ variantId: s.orderItems.variantId, quantity: s.orderItems.quantity })
    .from(s.orderItems)
    .where(eq(s.orderItems.orderId, orderId));
  for (const item of items) {
    // A variant deleted since the sale has nowhere to return stock to.
    if (!item.variantId) continue;
    await tx
      .update(s.variants)
      .set({ stock: sql`${s.variants.stock} + ${item.quantity}` })
      .where(eq(s.variants.id, item.variantId));
    await tx.insert(s.inventoryMovements).values({
      variantId: item.variantId,
      delta: item.quantity,
      reason,
      orderId,
      actorId,
    });
  }
}

type OrderRow = typeof s.orders.$inferSelect;

/** Move a locked order to a new status with every side effect that status implies. */
async function applyStatus(
  tx: Tx,
  order: OrderRow,
  to: OrderStatus,
  actorId: string | null,
  note: string | null,
) {
  if (!TRANSITIONS[order.status].includes(to)) {
    throw new OrderActionError(
      `An order that is ${order.status.replaceAll("_", " ")} can’t become ${to.replaceAll("_", " ")}.`,
    );
  }

  const patch: Partial<typeof s.orders.$inferInsert> = { status: to };

  if (to === "cancelled") {
    if (RESTOCK_ON_CANCEL.has(order.status)) await returnStock(tx, order.id, "release", actorId);
    // A cancelled order shouldn't count against the code's usage limit.
    if (order.couponCode) {
      await tx
        .update(s.coupons)
        .set({ timesUsed: sql`greatest(${s.coupons.timesUsed} - 1, 0)` })
        .where(eq(s.coupons.code, order.couponCode));
    }
    await tx
      .update(s.payments)
      .set({ state: "failed" })
      .where(and(eq(s.payments.orderId, order.id), eq(s.payments.state, "pending")));
  }

  if (to === "delivered" && order.paymentMethod === "cod") {
    // Cash collected by the courier on delivery.
    patch.paymentStatus = "paid";
    await tx
      .update(s.payments)
      .set({ state: "succeeded" })
      .where(and(eq(s.payments.orderId, order.id), eq(s.payments.state, "pending")));
    await tx.insert(s.orderEvents).values({
      orderId: order.id,
      kind: "payment",
      note: "Cash collected on delivery.",
      actorId,
    });
  }

  if (to === "returned") {
    await returnStock(tx, order.id, "return", actorId);
    if (order.paymentStatus === "paid") {
      patch.paymentStatus = "refunded";
      await tx
        .update(s.payments)
        .set({ state: "refunded" })
        .where(eq(s.payments.orderId, order.id));
    }
  }

  await tx.update(s.orders).set(patch).where(eq(s.orders.id, order.id));
  await tx.insert(s.orderEvents).values({
    orderId: order.id,
    kind: "status_change",
    fromStatus: order.status,
    toStatus: to,
    note,
    actorId,
  });
}

export async function changeStatus(
  number: string,
  to: OrderStatus,
  actorId: string,
  note: string | null,
) {
  return db().transaction(async (tx) => {
    const order = await lockOrder(tx, number);
    await applyStatus(tx, order, to, actorId, note);
    return { orderId: order.id, status: to };
  });
}

/**
 * InstaPay: staff checked their banking app. Approving marks the order paid
 * and confirmed; rejecting sends it back to waiting for a (new) reference.
 */
export async function reviewPayment(
  number: string,
  decision: "approve" | "reject",
  actorId: string,
  note: string | null,
) {
  return db().transaction(async (tx) => {
    const order = await lockOrder(tx, number);
    if (order.paymentMethod !== "instapay" || order.paymentStatus !== "awaiting_verification") {
      throw new OrderActionError("This order has no payment waiting for verification.");
    }
    const approve = decision === "approve";
    await tx
      .update(s.payments)
      .set({ state: approve ? "succeeded" : "failed" })
      .where(and(eq(s.payments.orderId, order.id), eq(s.payments.provider, "instapay")));
    await tx
      .update(s.orders)
      .set({ paymentStatus: approve ? "paid" : "failed" })
      .where(eq(s.orders.id, order.id));
    await tx.insert(s.orderEvents).values({
      orderId: order.id,
      kind: "payment",
      note:
        (approve ? "InstaPay payment verified." : "InstaPay payment could not be verified.") +
        (note ? ` ${note}` : ""),
      actorId,
    });
    if (!approve) return { orderId: order.id, status: null };

    // Paid: the order moves on exactly as a confirmed COD order would.
    await tx.update(s.orders).set({ status: "confirmed" }).where(eq(s.orders.id, order.id));
    await tx.insert(s.orderEvents).values({
      orderId: order.id,
      kind: "status_change",
      fromStatus: order.status,
      toStatus: "confirmed",
      actorId,
    });
    return { orderId: order.id, status: "confirmed" as OrderStatus };
  });
}

/**
 * Cancel InstaPay orders nobody paid for within the hold time, releasing their
 * stock and discount-code use. Each order is re-checked under a row lock, so
 * a reference submitted at the last moment is never cancelled out from under it.
 */
export async function expireUnpaidOrders(holdHours: number) {
  const cutoff = new Date(Date.now() - holdHours * 3_600_000);
  const stale = await db()
    .select({ number: s.orders.number })
    .from(s.orders)
    .where(
      and(
        eq(s.orders.paymentMethod, "instapay"),
        eq(s.orders.status, "pending_payment"),
        inArray(s.orders.paymentStatus, ["unpaid", "failed"]),
        lt(s.orders.placedAt, cutoff),
      ),
    )
    .limit(100);

  const changes: { orderId: string; status: OrderStatus; reason: "unpaid" }[] = [];
  for (const { number } of stale) {
    const change = await db().transaction(async (tx) => {
      const order = await lockOrder(tx, number);
      const stillUnpaid =
        order.status === "pending_payment" &&
        (order.paymentStatus === "unpaid" || order.paymentStatus === "failed") &&
        order.placedAt < cutoff;
      if (!stillUnpaid) return null;
      await applyStatus(
        tx,
        order,
        "cancelled",
        null,
        `Not paid within ${holdHours} hours — cancelled automatically.`,
      );
      return { orderId: order.id, status: "cancelled" as const, reason: "unpaid" as const };
    });
    if (change) changes.push(change);
  }
  return changes;
}

export type ContactOutcome = "confirmed" | "no_answer" | "cancelled";

/** Record a confirmation call. "Confirmed" and "cancelled" also move the order on. */
export async function recordContact(
  number: string,
  outcome: ContactOutcome,
  actorId: string,
  note: string | null,
) {
  return db().transaction(async (tx) => {
    const order = await lockOrder(tx, number);
    if (order.status !== "awaiting_confirmation") {
      throw new OrderActionError("This order isn’t waiting for a confirmation call.");
    }
    await tx
      .update(s.orders)
      .set({
        confirmationAttempts: sql`${s.orders.confirmationAttempts} + 1`,
        lastContactedAt: new Date(),
      })
      .where(eq(s.orders.id, order.id));
    await tx.insert(s.orderEvents).values({
      orderId: order.id,
      kind: "contact_attempt",
      note:
        {
          confirmed: "Customer confirmed by phone.",
          no_answer: "No answer.",
          cancelled: "Customer cancelled by phone.",
        }[outcome] + (note ? ` ${note}` : ""),
      actorId,
    });
    // Same transaction: a logged call and its status change succeed or fail together.
    if (outcome === "confirmed") await applyStatus(tx, order, "confirmed", actorId, null);
    if (outcome === "cancelled") await applyStatus(tx, order, "cancelled", actorId, note);
    const status: OrderStatus | null = outcome === "no_answer" ? null : outcome;
    return { orderId: order.id, status };
  });
}

export async function addNote(number: string, actorId: string, note: string) {
  const [order] = await db()
    .select({ id: s.orders.id })
    .from(s.orders)
    .where(eq(s.orders.number, number))
    .limit(1);
  if (!order) throw new OrderActionError("Order not found.", 404);
  await db().insert(s.orderEvents).values({ orderId: order.id, kind: "note", note, actorId });
}

/* ─── Reads ───────────────────────────────────────────────────────────────── */

export const ORDER_PAGE_SIZE = 25;

type OrderFilters = { status?: OrderStatus; query?: string };

/** The admin list's filters, shared by the paged list and the CSV export. */
function orderConditions(options: OrderFilters) {
  const conditions: SQL[] = [];
  if (options.status) conditions.push(eq(s.orders.status, options.status));
  if (options.query) {
    const term = `%${options.query.replace(/[%_\\]/g, "\\$&")}%`;
    const digits = options.query.replace(/\D/g, "");
    conditions.push(
      or(
        ilike(s.orders.number, term),
        ilike(sql`${s.orders.shippingAddress}->>'fullName'`, term),
        ilike(s.orders.email, term),
        // Phones are stored as +20…; match on the digits typed.
        ...(digits.length >= 4 ? [ilike(s.orders.phone, `%${digits.slice(-9)}%`)] : []),
      )!,
    );
  }
  return conditions.length ? and(...conditions) : undefined;
}

export async function listOrders(
  options: OrderFilters & { page: number },
): Promise<AdminOrderList> {
  const where = orderConditions(options);

  // Awaiting confirmation: oldest first (they've waited longest). Everything else: newest first.
  const order =
    options.status === "awaiting_confirmation" ? asc(s.orders.placedAt) : desc(s.orders.placedAt);

  const [rows, [total], statusCounts] = await Promise.all([
    db()
      .select({
        number: s.orders.number,
        status: s.orders.status,
        paymentStatus: s.orders.paymentStatus,
        placedAt: s.orders.placedAt,
        phone: s.orders.phone,
        name: sql<string>`${s.orders.shippingAddress}->>'fullName'`,
        region: sql<string>`${s.orders.shippingAddress}->>'region'`,
        total: s.orders.total,
        currency: s.orders.currency,
        attempts: s.orders.confirmationAttempts,
        // Outer table spelled out: Drizzle drops qualifiers in single-table queries.
        itemCount: sql<number>`(select coalesce(sum(order_items.quantity), 0)::int from order_items where order_items.order_id = "orders"."id")`,
      })
      .from(s.orders)
      .where(where)
      .orderBy(order)
      .limit(ORDER_PAGE_SIZE)
      .offset((options.page - 1) * ORDER_PAGE_SIZE),
    db().select({ total: count() }).from(s.orders).where(where),
    db()
      .select({ status: s.orders.status, total: count() })
      .from(s.orders)
      .groupBy(s.orders.status),
  ]);

  return {
    orders: rows.map((row) => ({ ...row, placedAt: row.placedAt.toISOString() })),
    total: total?.total ?? 0,
    page: options.page,
    pageCount: Math.max(1, Math.ceil((total?.total ?? 0) / ORDER_PAGE_SIZE)),
    counts: Object.fromEntries(statusCounts.map((row) => [row.status, row.total])),
  };
}

export async function orderDetail(number: string): Promise<AdminOrderDetail | null> {
  const [order] = await db().select().from(s.orders).where(eq(s.orders.number, number)).limit(1);
  if (!order) return null;

  const [items, events, payments, previousOrders] = await Promise.all([
    db().select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id)),
    db()
      .select({
        kind: s.orderEvents.kind,
        fromStatus: s.orderEvents.fromStatus,
        toStatus: s.orderEvents.toStatus,
        note: s.orderEvents.note,
        createdAt: s.orderEvents.createdAt,
        actor: s.user.name,
      })
      .from(s.orderEvents)
      .leftJoin(s.user, eq(s.orderEvents.actorId, s.user.id))
      .where(eq(s.orderEvents.orderId, order.id))
      .orderBy(desc(s.orderEvents.createdAt)),
    db().select().from(s.payments).where(eq(s.payments.orderId, order.id)),
    // Context for the confirmation call: has this phone ordered (or cancelled) before?
    db()
      .select({ number: s.orders.number, status: s.orders.status, placedAt: s.orders.placedAt })
      .from(s.orders)
      .where(and(eq(s.orders.phone, order.phone), sql`${s.orders.id} <> ${order.id}`))
      .orderBy(desc(s.orders.placedAt))
      .limit(10),
  ]);

  return {
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    placedAt: order.placedAt.toISOString(),
    email: order.email,
    phone: order.phone,
    shippingAddress: order.shippingAddress,
    shippingRate: order.shippingRate,
    customerNote: order.customerNote,
    confirmationAttempts: order.confirmationAttempts,
    lastContactedAt: order.lastContactedAt?.toISOString() ?? null,
    currency: order.currency,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    total: order.total,
    couponCode: order.couponCode,
    allowedTransitions: TRANSITIONS[order.status],
    items: items.map((item) => ({
      productName: item.productName,
      variantLabel: item.variantLabel,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      imageKey: item.imageKey,
      productId: item.productId,
    })),
    events: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    payments: payments.map((payment) => ({
      provider: payment.provider,
      method: payment.method,
      state: payment.state,
      amount: payment.amount,
      reference: payment.providerRef,
    })),
    previousOrders: previousOrders.map((row) => ({ ...row, placedAt: row.placedAt.toISOString() })),
  };
}

const COUNTED_STATUSES: OrderStatus[] = ["confirmed", "processing", "shipped", "delivered"];

/** Up to 5,000 orders matching the list filters, newest first, with their items. */
export async function exportOrders(options: OrderFilters) {
  const rows = await db()
    .select()
    .from(s.orders)
    .where(orderConditions(options))
    .orderBy(desc(s.orders.placedAt))
    .limit(5000);
  const items = rows.length
    ? await db()
        .select({
          orderId: s.orderItems.orderId,
          name: s.orderItems.productName,
          variant: s.orderItems.variantLabel,
          sku: s.orderItems.sku,
          quantity: s.orderItems.quantity,
        })
        .from(s.orderItems)
        .where(
          inArray(
            s.orderItems.orderId,
            rows.map((row) => row.id),
          ),
        )
    : [];
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
  }
  return rows.map((row) => ({ ...row, items: itemsByOrder.get(row.id) ?? [] }));
}

export async function dashboard(): Promise<AdminDashboard> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [[awaiting], [verifying], [today], [week], lowStock] = await Promise.all([
    db()
      .select({ total: count() })
      .from(s.orders)
      .where(eq(s.orders.status, "awaiting_confirmation")),
    db()
      .select({ total: count() })
      .from(s.orders)
      .where(eq(s.orders.paymentStatus, "awaiting_verification")),
    db().select({ total: count() }).from(s.orders).where(gte(s.orders.placedAt, startOfToday)),
    db()
      .select({
        orders: count(),
        revenue: sql<number>`coalesce(sum(${s.orders.total}), 0)::int`,
      })
      .from(s.orders)
      .where(and(gte(s.orders.placedAt, weekAgo), inArray(s.orders.status, COUNTED_STATUSES))),
    db()
      .select({
        variantId: s.variants.id,
        sku: s.variants.sku,
        size: s.variants.size,
        stock: s.variants.stock,
        productId: s.products.id,
        productName: s.products.name,
        colorName: s.productColors.name,
      })
      .from(s.variants)
      .innerJoin(s.products, eq(s.variants.productId, s.products.id))
      .leftJoin(s.productColors, eq(s.variants.colorId, s.productColors.id))
      .where(
        and(
          eq(s.variants.isActive, true),
          eq(s.products.status, "active"),
          sql`${s.variants.stock} <= 3`,
        ),
      )
      .orderBy(asc(s.variants.stock), asc(s.products.name))
      .limit(12),
  ]);

  return {
    awaitingConfirmation: awaiting?.total ?? 0,
    paymentsToVerify: verifying?.total ?? 0,
    ordersToday: today?.total ?? 0,
    week: { orders: week?.orders ?? 0, revenue: week?.revenue ?? 0, currency: "EGP" },
    lowStock,
  };
}
