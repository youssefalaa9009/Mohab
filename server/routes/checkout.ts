import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { GOVERNORATES, checkoutSchema, fieldErrors } from "../../src/features/checkout/schema.js";
import { CART_COOKIE, clearCartCookie } from "../cart/service.js";
import { CheckoutError, orderSummary, placeOrder, shippingOptions } from "../checkout/service.js";
import { sendEmail } from "../email/send.js";
import { newOrderNotification, orderConfirmationEmail } from "../email/templates.js";
import { currentUser } from "../auth.js";
import { serverEnv } from "../env.js";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
  replyIdempotent,
} from "../http/idempotency.js";
import { hashToken, requireSameOrigin } from "../http/security.js";
import { instapayDetails } from "../payments/settings.js";

const shippingQuery = z.object({ governorate: z.enum(GOVERNORATES) });

export async function checkoutRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSameOrigin);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
  });

  app.get("/shipping", async (request, reply) => {
    const query = shippingQuery.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "Choose your governorate." });
    return shippingOptions(request, query.data.governorate);
  });

  /** Methods offered at checkout. InstaPay appears only once staff configure it. */
  app.get("/payment-methods", async () => ({ cod: true, instapay: await instapayDetails() }));

  app.post(
    "/",
    // Each order is a confirmation phone call: bound how fast one client can create them.
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = checkoutSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Please check the highlighted fields.",
          fields: fieldErrors(parsed.error),
        });
      }

      // A double click, a retry after a dropped connection or a resent request
      // must never place a second order: one key, one order.
      // Scoped to this shopper's bag, so a key is useless without their cookie.
      const bag = request.cookies[CART_COOKIE];
      const claim = await claimIdempotencyKey<{ number: string; accessKey: string }>(
        request,
        `checkout:${bag ? hashToken(bag).slice(0, 16) : "no-bag"}`,
      );
      if (claim.kind !== "fresh") return replyIdempotent(reply, claim);

      try {
        const viewer = await currentUser(request);
        const placed = await placeOrder(request, parsed.data, viewer?.id ?? null);
        clearCartCookie(reply);

        const env = serverEnv();
        const summary = await orderSummary(placed.orderId);
        if (summary) {
          const statusUrl = `${env.SITE_URL}/checkout/confirmation/${placed.number}?key=${placed.accessKey}`;
          // Fire and forget: sendEmail never throws, and the order stands either way.
          if (summary.email)
            void sendEmail(orderConfirmationEmail(summary, statusUrl), request.log);
          if (env.ORDER_NOTIFY_EMAIL) {
            void sendEmail(
              {
                to: env.ORDER_NOTIFY_EMAIL,
                ...newOrderNotification(summary, `${env.SITE_URL}/admin/orders/${placed.number}`),
              },
              request.log,
            );
          }
        }

        const response = { number: placed.number, accessKey: placed.accessKey };
        await completeIdempotencyKey(claim.key, response);
        return reply.status(201).send(response);
      } catch (error) {
        await releaseIdempotencyKey(claim.key);
        if (error instanceof CheckoutError) {
          return reply.status(error.status).send({ error: error.message, fields: error.fields });
        }
        throw error;
      }
    },
  );
}
