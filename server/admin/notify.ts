import type { FastifyBaseLogger } from "fastify";
import { orderSummary } from "../checkout/service.js";
import { sendEmail } from "../email/send.js";
import {
  NOTIFIED_STATUSES,
  orderStatusEmail,
  paymentRejectedEmail,
  type NotifiedStatus,
} from "../email/templates.js";
import { serverEnv } from "../env.js";

const notified = (status: string | null): status is NotifiedStatus =>
  (NOTIFIED_STATUSES as readonly string[]).includes(status ?? "");

/**
 * Email the customer about a status change, after the change is committed.
 * Silent when the order has no email or the status is internal.
 */
export async function notifyStatusChange(
  change: { orderId: string; status: string | null; reason?: "unpaid" },
  log: FastifyBaseLogger,
) {
  if (!notified(change.status)) return;
  const status = change.status;
  try {
    const order = await orderSummary(change.orderId);
    if (!order?.email) return;
    // Guests open the tracker with number + phone; the number is prefilled.
    const trackUrl = `${serverEnv().SITE_URL}/help/track-order?number=${encodeURIComponent(order.number)}`;
    await sendEmail(orderStatusEmail(order, status, trackUrl, change.reason), log);
  } catch (error) {
    // Runs after the response; the status change itself already succeeded.
    log.error({ err: error, orderId: change.orderId }, "status email failed");
  }
}

/** InstaPay transfer couldn't be verified: ask the customer to check and resend the reference. */
export async function notifyPaymentRejected(orderId: string, log: FastifyBaseLogger) {
  try {
    const order = await orderSummary(orderId);
    if (!order?.email) return;
    const trackUrl = `${serverEnv().SITE_URL}/help/track-order?number=${encodeURIComponent(order.number)}`;
    await sendEmail(paymentRejectedEmail(order, trackUrl), log);
  } catch (error) {
    log.error({ err: error, orderId }, "payment-rejected email failed");
  }
}
