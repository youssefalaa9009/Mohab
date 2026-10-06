import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { GOVERNORATES, normalizeEgyptianMobile } from "../../src/features/checkout/schema.js";
import { currentUser } from "../auth.js";
import { orderSummary } from "../checkout/service.js";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";
import { requireSameOrigin } from "../http/security.js";
import { referenceBody, reportTransfer } from "../payments/instapay.js";

/** Any signed-in visitor, customer or staff. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const viewer = await currentUser(request);
  if (!viewer) return reply.status(401).send({ error: "Please sign in." });
  request.viewer = viewer;
}

const phone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const normalized = normalizeEgyptianMobile(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Enter an Egyptian mobile number, e.g. 010 1234 5678.",
      });
      return z.NEVER;
    }
    return normalized;
  });

const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .max(40)
    .nullish()
    .transform((value) => value || null),
  fullName: z.string().trim().min(2).max(120),
  phone: phone.refine((value) => value !== null, "Enter a mobile number."),
  governorate: z.enum(GOVERNORATES),
  city: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(5).max(200),
  line2: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((value) => value || null),
  isDefault: z.boolean().optional(),
});

function invalid(reply: FastifyReply, error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
  return reply.status(400).send({ error: "Please check the highlighted fields.", fields });
}

async function listAddresses(userId: string) {
  const rows = await db()
    .select()
    .from(s.addresses)
    .where(eq(s.addresses.userId, userId))
    .orderBy(desc(s.addresses.isDefaultShipping), desc(s.addresses.updatedAt));
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    fullName: row.fullName,
    phone: row.phone,
    governorate: row.region,
    city: row.city,
    line1: row.line1,
    line2: row.line2,
    isDefault: row.isDefaultShipping,
  }));
}

export async function accountRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSameOrigin);
  app.addHook("preHandler", requireUser);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
  });

  app.get("/me", async (request) => {
    const [row] = await db()
      .select()
      .from(s.user)
      .where(eq(s.user.id, request.viewer!.id))
      .limit(1);
    return {
      id: row!.id,
      name: row!.name,
      email: row!.email,
      phone: row!.phone,
      marketingOptIn: row!.marketingOptIn,
      role: row!.role,
    };
  });

  app.put("/me", async (request, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(2, "Enter your name.").max(120),
        phone,
        marketingOptIn: z.boolean(),
      })
      .safeParse(request.body);
    if (!body.success) return invalid(reply, body.error);
    await db().update(s.user).set(body.data).where(eq(s.user.id, request.viewer!.id));
    return { ok: true };
  });

  /** Prefill for checkout: who they are and where they usually receive orders. */
  app.get("/checkout-defaults", async (request) => {
    const [row] = await db()
      .select()
      .from(s.user)
      .where(eq(s.user.id, request.viewer!.id))
      .limit(1);
    const [address] = await listAddresses(request.viewer!.id);
    return { name: row!.name, email: row!.email, phone: row!.phone, address: address ?? null };
  });

  app.get("/orders", async (request) => {
    const rows = await db()
      .select({
        number: s.orders.number,
        status: s.orders.status,
        placedAt: s.orders.placedAt,
        total: s.orders.total,
        currency: s.orders.currency,
      })
      .from(s.orders)
      .where(eq(s.orders.userId, request.viewer!.id))
      .orderBy(desc(s.orders.placedAt))
      .limit(100);
    return rows.map((row) => ({ ...row, placedAt: row.placedAt.toISOString() }));
  });

  app.get<{ Params: { number: string } }>("/orders/:number", async (request, reply) => {
    const [row] = await db()
      .select({ id: s.orders.id })
      .from(s.orders)
      .where(
        and(eq(s.orders.number, request.params.number), eq(s.orders.userId, request.viewer!.id)),
      )
      .limit(1);
    // Someone else's order is indistinguishable from a missing one.
    const summary = row ? await orderSummary(row.id) : null;
    return summary ?? reply.status(404).send({ error: "Order not found." });
  });

  /** InstaPay: a signed-in customer reports the transfer for one of their orders. */
  app.post<{ Params: { number: string } }>(
    "/orders/:number/instapay",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const body = referenceBody.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: "Please check the reference.",
          fields: { reference: body.error.issues[0]?.message ?? "Invalid reference." },
        });
      }
      const [row] = await db()
        .select({ id: s.orders.id })
        .from(s.orders)
        .where(
          and(eq(s.orders.number, request.params.number), eq(s.orders.userId, request.viewer!.id)),
        )
        .limit(1);
      if (!row) return reply.status(404).send({ error: "Order not found." });
      return reportTransfer(row.id, body.data.reference, reply, request.log);
    },
  );

  app.get("/addresses", async (request) => listAddresses(request.viewer!.id));

  app.post("/addresses", async (request, reply) => {
    const body = addressSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error);
    const userId = request.viewer!.id;
    const existing = await listAddresses(userId);
    const makeDefault = body.data.isDefault || existing.length === 0;
    await db().transaction(async (tx) => {
      if (makeDefault) {
        await tx
          .update(s.addresses)
          .set({ isDefaultShipping: false })
          .where(eq(s.addresses.userId, userId));
      }
      await tx.insert(s.addresses).values({
        userId,
        label: body.data.label,
        fullName: body.data.fullName,
        phone: body.data.phone!,
        region: body.data.governorate,
        city: body.data.city,
        line1: body.data.line1,
        line2: body.data.line2,
        isDefaultShipping: makeDefault,
      });
    });
    return reply.status(201).send(await listAddresses(userId));
  });

  app.put<{ Params: { id: string } }>("/addresses/:id", async (request, reply) => {
    const id = z.uuid().safeParse(request.params.id);
    const body = addressSchema.safeParse(request.body);
    if (!id.success) return reply.status(404).send({ error: "Address not found." });
    if (!body.success) return invalid(reply, body.error);
    const userId = request.viewer!.id;
    await db().transaction(async (tx) => {
      if (body.data.isDefault) {
        await tx
          .update(s.addresses)
          .set({ isDefaultShipping: false })
          .where(eq(s.addresses.userId, userId));
      }
      await tx
        .update(s.addresses)
        .set({
          label: body.data.label,
          fullName: body.data.fullName,
          phone: body.data.phone!,
          region: body.data.governorate,
          city: body.data.city,
          line1: body.data.line1,
          line2: body.data.line2,
          ...(body.data.isDefault ? { isDefaultShipping: true } : {}),
        })
        // Scoped to the owner: another user's address id simply matches nothing.
        .where(and(eq(s.addresses.id, id.data), eq(s.addresses.userId, userId)));
    });
    return listAddresses(userId);
  });

  app.delete<{ Params: { id: string } }>("/addresses/:id", async (request, reply) => {
    const id = z.uuid().safeParse(request.params.id);
    if (!id.success) return reply.status(404).send({ error: "Address not found." });
    const userId = request.viewer!.id;
    await db()
      .delete(s.addresses)
      .where(and(eq(s.addresses.id, id.data), eq(s.addresses.userId, userId)));
    // Keep exactly one default while any address remains.
    const remaining = await listAddresses(userId);
    const first = remaining[0];
    if (first && !remaining.some((address) => address.isDefault)) {
      await db()
        .update(s.addresses)
        .set({ isDefaultShipping: true })
        .where(eq(s.addresses.id, first.id));
    }
    return listAddresses(userId);
  });
}
