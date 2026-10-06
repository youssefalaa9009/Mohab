import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalizeEgyptianMobile } from "../../src/features/checkout/schema.js";
import { orderByAccessKey, orderByPhone, orderIdByAccessKey } from "../checkout/service.js";
import { referenceBody, reportTransfer } from "../payments/instapay.js";
import { requireSameOrigin } from "../http/security.js";

const numberSchema = z.string().regex(/^Q-\d{1,10}$/);

export async function orderRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSameOrigin);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
  });

  /** Guest access through the secret key in the confirmation link. */
  app.get<{ Params: { number: string }; Querystring: { key?: string } }>(
    "/:number",
    async (request, reply) => {
      const number = numberSchema.safeParse(request.params.number);
      const key = request.query.key;
      if (!number.success || !key || key.length > 100) {
        return reply.status(404).send({ error: "Order not found." });
      }
      const order = await orderByAccessKey(number.data, key);
      return order ?? reply.status(404).send({ error: "Order not found." });
    },
  );

  /** InstaPay: the guest reports their transfer, authorised by the confirmation-link key. */
  app.post<{ Params: { number: string } }>(
    "/:number/instapay",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const number = numberSchema.safeParse(request.params.number);
      const body = referenceBody
        .extend({ key: z.string().min(1).max(100) })
        .safeParse(request.body);
      if (!number.success) return reply.status(404).send({ error: "Order not found." });
      if (!body.success) {
        return reply.status(400).send({
          error: "Please check the reference.",
          fields: { reference: body.error.issues[0]?.message ?? "Invalid reference." },
        });
      }
      const order = await orderIdByAccessKey(number.data, body.data.key);
      if (!order) return reply.status(404).send({ error: "Order not found." });
      return reportTransfer(order, body.data.reference, reply, request.log);
    },
  );

  /** Track an order with its number and the phone it was placed with. */
  app.post(
    "/track",
    // Slows down guessing order-number/phone pairs.
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const body = z
        .object({ number: z.string().trim().toUpperCase(), phone: z.string() })
        .safeParse(request.body);
      const number = body.success ? numberSchema.safeParse(body.data.number) : null;
      const phone = body.success ? normalizeEgyptianMobile(body.data.phone) : null;
      if (!number?.success || !phone) {
        return reply.status(400).send({ error: "Enter your order number and phone number." });
      }
      const order = await orderByPhone(number.data, phone);
      // One message for both "no such order" and "wrong phone": don't confirm which.
      return (
        order ?? reply.status(404).send({ error: "We couldn’t find an order with those details." })
      );
    },
  );
}
