import type { FastifyInstance } from "fastify";
import { notifyStatusChange } from "./admin/notify.js";
import { expireUnpaidOrders } from "./admin/orders.js";
import { purgeIdempotencyKeys } from "./http/idempotency.js";
import { getPaymentSettings } from "./payments/settings.js";

const EVERY_MS = 15 * 60_000;

/**
 * Housekeeping that runs inside the app process. There is one app container,
 * and each job is safe to run twice (row locks + re-checks), so no external
 * scheduler is needed.
 */
export function startJobs(app: FastifyInstance): () => void {
  const run = async () => {
    try {
      const { instapay } = await getPaymentSettings();
      const cancelled = await expireUnpaidOrders(instapay.holdHours);
      for (const change of cancelled) void notifyStatusChange(change, app.log);
      if (cancelled.length) app.log.info(`cancelled ${cancelled.length} unpaid InstaPay order(s)`);
      await purgeIdempotencyKeys();
    } catch (error) {
      app.log.error({ err: error }, "unpaid-order sweep failed");
    }
  };
  // A minute after start (let the app settle), then every 15 minutes.
  const first = setTimeout(run, 60_000);
  const timer = setInterval(run, EVERY_MS);
  first.unref();
  timer.unref();
  // Hooks can't be added once the app is listening, so the caller stops jobs on shutdown.
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
