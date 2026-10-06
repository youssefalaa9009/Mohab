import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { MAX_LINE_QUANTITY } from "../../src/features/cart/types.js";
import {
  CartError,
  addItem,
  applyCoupon,
  ensureCart,
  findCart,
  priceCart,
  removeCoupon,
  removeItem,
  updateItem,
} from "../cart/service.js";
import { requireSameOrigin } from "../http/security.js";

const addSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY).default(1),
});
const updateSchema = z.object({ quantity: z.number().int().min(0).max(MAX_LINE_QUANTITY) });
const couponSchema = z.object({ code: z.string().trim().min(1).max(64) });
const itemParams = z.object({ itemId: z.uuid() });

function invalid(reply: FastifyReply) {
  return reply.status(400).send({ error: "That request wasn’t valid." });
}

function failure(reply: FastifyReply, error: unknown) {
  if (error instanceof CartError) return reply.status(error.status).send({ error: error.message });
  throw error;
}

export async function cartRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSameOrigin);
  // Bag contents are personal: never let a shared cache store them.
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
  });

  app.get("/", async (request) => (await priceCart(await findCart(request))).view);

  app.post("/items", async (request, reply) => {
    const body = addSchema.safeParse(request.body);
    if (!body.success) return invalid(reply);
    try {
      const cart = await ensureCart(request, reply);
      const notice = await addItem(cart, body.data.variantId, body.data.quantity);
      return { cart: (await priceCart(cart)).view, notice };
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.patch("/items/:itemId", async (request, reply) => {
    const params = itemParams.safeParse(request.params);
    const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) return invalid(reply);
    const cart = await findCart(request);
    if (!cart) return reply.status(404).send({ error: "Your bag is empty." });
    try {
      const notice = await updateItem(cart, params.data.itemId, body.data.quantity);
      return { cart: (await priceCart(cart)).view, notice };
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.delete("/items/:itemId", async (request, reply) => {
    const params = itemParams.safeParse(request.params);
    if (!params.success) return invalid(reply);
    const cart = await findCart(request);
    if (!cart) return reply.status(404).send({ error: "Your bag is empty." });
    await removeItem(cart, params.data.itemId);
    return { cart: (await priceCart(cart)).view };
  });

  app.post("/coupon", async (request, reply) => {
    const body = couponSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Enter a code." });
    const cart = await findCart(request);
    if (!cart) return reply.status(422).send({ error: "Add something to your bag first." });
    try {
      await applyCoupon(cart, body.data.code);
      return { cart: (await priceCart(cart)).view };
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.delete("/coupon", async (request, reply) => {
    const cart = await findCart(request);
    if (!cart) return reply.status(404).send({ error: "Your bag is empty." });
    await removeCoupon(cart);
    return { cart: (await priceCart(cart)).view };
  });
}
