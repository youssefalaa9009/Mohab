import type { FastifyBaseLogger, FastifyReply } from "fastify";
import { z } from "zod";
import {
  CheckoutError,
  instapayReference,
  orderSummary,
  submitInstapayReference,
} from "../checkout/service.js";
import { sendEmail } from "../email/send.js";
import { serverEnv } from "../env.js";

export const referenceBody = z.object({ reference: instapayReference });

/**
 * Shared by the guest (confirmation-link) and account routes: record the
 * reference, tell staff, and answer with the updated order.
 */
export async function reportTransfer(
  orderId: string,
  reference: string,
  reply: FastifyReply,
  log: FastifyBaseLogger,
) {
  try {
    const order = await submitInstapayReference(orderId, reference);
    const env = serverEnv();
    if (env.ORDER_NOTIFY_EMAIL) {
      const text = [
        `InstaPay transfer reported for order ${order.number}.`,
        `Reference: ${reference}`,
        "Check your banking app, then verify or reject it in the admin:",
        `${env.SITE_URL}/admin/orders/${order.number}`,
      ].join("\n");
      void sendEmail(
        {
          to: env.ORDER_NOTIFY_EMAIL,
          subject: `Verify InstaPay payment — ${order.number}`,
          text,
          html: text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll("\n", "<br>"),
        },
        log,
      );
    }
    return orderSummary(orderId);
  } catch (error) {
    if (error instanceof CheckoutError) {
      return reply.status(error.status).send({ error: error.message, fields: error.fields });
    }
    throw error;
  }
}
