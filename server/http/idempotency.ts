import { eq, lt, sql } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";

/** Client keys: 16–100 URL-safe characters (the checkout sends 32 hex). */
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;

export type IdempotentResult<T> =
  { kind: "fresh"; key: string | null } | { kind: "replay"; response: T } | { kind: "in-progress" };

/**
 * Claim the request's Idempotency-Key header for `scope`. Only one request per
 * key ever runs: the first claims it, a repeat gets the stored response, and a
 * repeat that arrives mid-flight is told to retry shortly. No header → `fresh`
 * with a null key (the request runs as normal).
 */
export async function claimIdempotencyKey<T>(
  request: FastifyRequest,
  scope: string,
): Promise<IdempotentResult<T> | { kind: "invalid" }> {
  const header = request.headers["idempotency-key"];
  if (header === undefined) return { kind: "fresh", key: null };
  if (typeof header !== "string" || !KEY_PATTERN.test(header)) return { kind: "invalid" };

  const key = `${scope}:${header}`;
  const [claimed] = await db()
    .insert(s.idempotencyKeys)
    .values({ key })
    .onConflictDoNothing()
    .returning({ key: s.idempotencyKeys.key });
  if (claimed) return { kind: "fresh", key };

  const [existing] = await db()
    .select({ response: s.idempotencyKeys.response })
    .from(s.idempotencyKeys)
    .where(eq(s.idempotencyKeys.key, key))
    .limit(1);
  return existing?.response
    ? { kind: "replay", response: existing.response as T }
    : { kind: "in-progress" };
}

/** Store the response a repeat of this key should receive. */
export async function completeIdempotencyKey(key: string | null, response: object) {
  if (!key) return;
  await db()
    .update(s.idempotencyKeys)
    .set({ response: response as Record<string, unknown> })
    .where(eq(s.idempotencyKeys.key, key));
}

/** The request failed: free the key so a corrected retry can run. */
export async function releaseIdempotencyKey(key: string | null) {
  if (!key) return;
  await db().delete(s.idempotencyKeys).where(eq(s.idempotencyKeys.key, key));
}

/** Uniform replies for the non-fresh outcomes. */
export function replyIdempotent(
  reply: FastifyReply,
  outcome: { kind: "replay"; response: object } | { kind: "in-progress" } | { kind: "invalid" },
  status = 201,
) {
  if (outcome.kind === "invalid") {
    return reply.status(400).send({ error: "Invalid Idempotency-Key header." });
  }
  if (outcome.kind === "in-progress") {
    return reply
      .status(409)
      .header("retry-after", "1")
      .send({ error: "This request is already being processed.", code: "in_progress" });
  }
  return reply.status(status).header("idempotent-replayed", "true").send(outcome.response);
}

/** Keys are only needed for retries in the moment; a day is generous. */
export async function purgeIdempotencyKeys() {
  await db()
    .delete(s.idempotencyKeys)
    .where(lt(s.idempotencyKeys.createdAt, sql`now() - interval '24 hours'`));
}
