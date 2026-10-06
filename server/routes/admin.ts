import type { FastifyInstance, FastifyReply } from "fastify";
import { notifyPaymentRejected, notifyStatusChange } from "../admin/notify.js";
import { z } from "zod";
import {
  OrderActionError,
  addNote,
  changeStatus,
  dashboard,
  listOrders,
  orderDetail,
  exportOrders,
  recordContact,
  reviewPayment,
  type OrderStatus,
} from "../admin/orders.js";
import { requireAdmin } from "../auth.js";
import * as s from "../db/schema/index.js";
import { sendCsv } from "../http/csv.js";
import { requireSameOrigin } from "../http/security.js";

const statusEnum = z.enum(s.orderStatus.enumValues);
/** +201012345678 → "010 1234 5678": readable, and a spreadsheet keeps it as text. */
function localPhone(e164: string) {
  const local = e164.startsWith("+20") ? `0${e164.slice(3)}` : e164;
  return local.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1 $2 $3");
}

const orderNumber = z.string().regex(/^Q-\d{1,10}$/);
const note = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((value) => value || null);

function failure(reply: FastifyReply, error: unknown) {
  if (error instanceof OrderActionError) {
    return reply.status(error.status).send({ error: error.message });
  }
  throw error;
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSameOrigin);
  app.addHook("preHandler", requireAdmin);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
  });

  app.get("/me", async (request) => request.viewer);
  app.get("/dashboard", async () => dashboard());

  /** The list's current filters, as a spreadsheet for accounting or the courier. */
  app.get("/orders.csv", async (request, reply) => {
    const query = z
      .object({ status: statusEnum.optional(), q: z.string().trim().max(100).optional() })
      .safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "Invalid filters." });
    const rows = await exportOrders({
      status: query.data.status as OrderStatus | undefined,
      query: query.data.q || undefined,
    });
    const money = (minor: number) => (minor / 100).toFixed(2);
    const cairo = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Africa/Cairo",
      dateStyle: "short",
      timeStyle: "short",
    });
    const stamp = cairo.format(new Date()).slice(0, 10);
    return sendCsv(
      reply,
      `quattro-orders-${stamp}.csv`,
      [
        "order",
        "placed_at_cairo",
        "status",
        "payment_method",
        "payment_status",
        "customer",
        "phone",
        "email",
        "governorate",
        "city",
        "address",
        "items",
        "units",
        "subtotal",
        "discount",
        "delivery",
        "total",
        "currency",
        "coupon",
        "customer_note",
      ],
      rows.map((row) => [
        row.number,
        cairo.format(row.placedAt),
        row.status,
        row.paymentMethod,
        row.paymentStatus,
        row.shippingAddress.fullName,
        localPhone(row.phone),
        row.email,
        row.shippingAddress.region,
        row.shippingAddress.city,
        [row.shippingAddress.line1, row.shippingAddress.line2].filter(Boolean).join(", "),
        row.items
          .map(
            (item) =>
              `${item.quantity} × ${item.name}${item.variant ? ` (${item.variant})` : ""} [${item.sku}]`,
          )
          .join("; "),
        row.items.reduce((sum, item) => sum + item.quantity, 0),
        money(row.subtotal),
        money(row.discountTotal),
        money(row.shippingTotal),
        money(row.total),
        row.currency,
        row.couponCode,
        row.customerNote,
      ]),
    );
  });

  app.get("/orders", async (request, reply) => {
    const query = z
      .object({
        status: statusEnum.optional(),
        q: z.string().trim().max(100).optional(),
        page: z.coerce.number().int().min(1).max(10_000).default(1),
      })
      .safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "Invalid filters." });
    return listOrders({
      status: query.data.status as OrderStatus | undefined,
      query: query.data.q || undefined,
      page: query.data.page,
    });
  });

  app.get<{ Params: { number: string } }>("/orders/:number", async (request, reply) => {
    const number = orderNumber.safeParse(request.params.number);
    const order = number.success ? await orderDetail(number.data) : null;
    return order ?? reply.status(404).send({ error: "Order not found." });
  });

  app.post<{ Params: { number: string } }>("/orders/:number/contact", async (request, reply) => {
    const number = orderNumber.safeParse(request.params.number);
    const body = z
      .object({ outcome: z.enum(["confirmed", "no_answer", "cancelled"]), note })
      .safeParse(request.body);
    if (!number.success || !body.success)
      return reply.status(400).send({ error: "Invalid request." });
    try {
      const change = await recordContact(
        number.data,
        body.data.outcome,
        request.viewer!.id,
        body.data.note,
      );
      void notifyStatusChange(change, request.log);
      return orderDetail(number.data);
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.post<{ Params: { number: string } }>("/orders/:number/status", async (request, reply) => {
    const number = orderNumber.safeParse(request.params.number);
    const body = z.object({ to: statusEnum, note }).safeParse(request.body);
    if (!number.success || !body.success)
      return reply.status(400).send({ error: "Invalid request." });
    try {
      const change = await changeStatus(
        number.data,
        body.data.to,
        request.viewer!.id,
        body.data.note,
      );
      void notifyStatusChange(change, request.log);
      return orderDetail(number.data);
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.post<{ Params: { number: string } }>("/orders/:number/payment", async (request, reply) => {
    const number = orderNumber.safeParse(request.params.number);
    const body = z
      .object({ decision: z.enum(["approve", "reject"]), note })
      .safeParse(request.body);
    if (!number.success || !body.success)
      return reply.status(400).send({ error: "Invalid request." });
    try {
      const change = await reviewPayment(
        number.data,
        body.data.decision,
        request.viewer!.id,
        body.data.note,
      );
      if (change.status) void notifyStatusChange(change, request.log);
      else void notifyPaymentRejected(change.orderId, request.log);
      return orderDetail(number.data);
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.post<{ Params: { number: string } }>("/orders/:number/notes", async (request, reply) => {
    const number = orderNumber.safeParse(request.params.number);
    const body = z.object({ note: z.string().trim().min(1).max(1000) }).safeParse(request.body);
    if (!number.success || !body.success)
      return reply.status(400).send({ error: "Write a note first." });
    try {
      await addNote(number.data, request.viewer!.id, body.data.note);
      return orderDetail(number.data);
    } catch (error) {
      return failure(reply, error);
    }
  });
}
