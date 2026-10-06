import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { GOVERNORATES } from "../../src/features/checkout/schema.js";
import {
  SettingsError,
  deleteCategory,
  deleteCollection,
  listCategories,
  listCollections,
  listCoupons,
  listCustomers,
  listShippingRates,
  saveCategory,
  saveCollection,
  saveCoupon,
  saveShippingRate,
} from "../admin/settings.js";
import { requireAdmin } from "../auth.js";
import { requireSameOrigin } from "../http/security.js";
import {
  getPaymentSettings,
  paymentSettingsSchema,
  savePaymentSettings,
} from "../payments/settings.js";

const id = z.uuid();
/** Whole currency units in, minor units stored. */
const money = z
  .number()
  .min(0)
  .max(10_000_000)
  .transform((value) => Math.round(value * 100));
const optionalInt = z.number().int().min(0).max(1_000_000).nullable();
const date = z
  .string()
  .nullable()
  .transform((value, ctx) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date." });
      return z.NEVER;
    }
    return parsed;
  });
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only."),
    type: z.enum(["percent", "fixed", "free_shipping"]),
    /** Percent for "percent"; EGP for "fixed". */
    value: z.number().min(0).max(10_000_000),
    minSubtotal: money.nullable(),
    startsAt: date,
    endsAt: date,
    usageLimit: optionalInt,
    perCustomerLimit: optionalInt,
    isActive: z.boolean(),
  })
  .transform((input) => ({
    ...input,
    // Fixed discounts are entered in EGP like every other price.
    value: input.type === "fixed" ? Math.round(input.value * 100) : Math.round(input.value),
  }));

const rateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  region: z.enum(GOVERNORATES).nullable(),
  price: money,
  freeOver: money.nullable(),
  etaMinDays: z.number().int().min(0).max(60).nullable(),
  etaMaxDays: z.number().int().min(0).max(60).nullable(),
  isActive: z.boolean(),
  position: z.number().int().min(0).max(1000),
});

const taxonomySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: text(1000),
  isActive: z.boolean(),
  position: z.number().int().min(0).max(1000),
  startsAt: date.optional(),
  endsAt: date.optional(),
});

function invalid(reply: FastifyReply, error: z.ZodError) {
  const issue = error.issues[0];
  return reply.status(400).send({
    error: issue ? `${issue.path.join(".") || "Request"}: ${issue.message}` : "Invalid request.",
  });
}

async function attempt(
  reply: FastifyReply,
  action: () => Promise<unknown>,
  after: () => Promise<unknown>,
) {
  try {
    await action();
    return await after();
  } catch (error) {
    if (error instanceof SettingsError)
      return reply.status(error.status).send({ error: error.message });
    throw error;
  }
}

export async function adminSettingsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSameOrigin);
  app.addHook("preHandler", requireAdmin);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
  });

  // Discount codes
  app.get("/coupons", async () => listCoupons());
  app.post("/coupons", async (request, reply) => {
    const body = couponSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error);
    return attempt(reply, () => saveCoupon(null, body.data), listCoupons);
  });
  app.put<{ Params: { id: string } }>("/coupons/:id", async (request, reply) => {
    const couponId = id.safeParse(request.params.id);
    const body = couponSchema.safeParse(request.body);
    if (!couponId.success) return reply.status(404).send({ error: "Not found." });
    if (!body.success) return invalid(reply, body.error);
    return attempt(reply, () => saveCoupon(couponId.data, body.data), listCoupons);
  });

  // Delivery rates
  app.get("/shipping-rates", async () => listShippingRates());
  app.post("/shipping-rates", async (request, reply) => {
    const body = rateSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error);
    return attempt(reply, () => saveShippingRate(null, body.data), listShippingRates);
  });
  app.put<{ Params: { id: string } }>("/shipping-rates/:id", async (request, reply) => {
    const rateId = id.safeParse(request.params.id);
    const body = rateSchema.safeParse(request.body);
    if (!rateId.success) return reply.status(404).send({ error: "Not found." });
    if (!body.success) return invalid(reply, body.error);
    return attempt(reply, () => saveShippingRate(rateId.data, body.data), listShippingRates);
  });

  // Categories & collections
  const taxonomy = { categories: listCategories, collections: listCollections };
  app.get("/catalog", async () => ({
    categories: await listCategories(),
    collections: await listCollections(),
  }));
  for (const kind of ["categories", "collections"] as const) {
    const save = kind === "categories" ? saveCategory : saveCollection;
    const remove = kind === "categories" ? deleteCategory : deleteCollection;
    app.post(`/${kind}`, async (request, reply) => {
      const body = taxonomySchema.safeParse(request.body);
      if (!body.success) return invalid(reply, body.error);
      return attempt(reply, () => save(null, body.data), taxonomy[kind]);
    });
    app.put<{ Params: { id: string } }>(`/${kind}/:id`, async (request, reply) => {
      const itemId = id.safeParse(request.params.id);
      const body = taxonomySchema.safeParse(request.body);
      if (!itemId.success) return reply.status(404).send({ error: "Not found." });
      if (!body.success) return invalid(reply, body.error);
      return attempt(reply, () => save(itemId.data, body.data), taxonomy[kind]);
    });
    app.delete<{ Params: { id: string } }>(`/${kind}/:id`, async (request, reply) => {
      const itemId = id.safeParse(request.params.id);
      if (!itemId.success) return reply.status(404).send({ error: "Not found." });
      return attempt(reply, () => remove(itemId.data), taxonomy[kind]);
    });
  }

  // Customers
  // Payment methods (InstaPay details)
  app.get("/payment-settings", async () => getPaymentSettings());
  app.put("/payment-settings", async (request, reply) => {
    const body = paymentSettingsSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error);
    return savePaymentSettings(body.data);
  });

  app.get("/customers", async (request) => {
    const q = z.object({ q: z.string().trim().max(100).optional() }).safeParse(request.query);
    return listCustomers(q.success ? q.data.q || undefined : undefined);
  });
}
