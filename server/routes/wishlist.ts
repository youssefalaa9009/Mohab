import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { currentUser } from "../auth.js";
import { visibleProductIds, visibleSummaries } from "../catalog/repository.js";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";
import { requireSameOrigin } from "../http/security.js";
import { requireUser } from "./account.js";

/** Generous for a wishlist, small enough that one request can't build a huge query. */
const LIMIT = 100;

const productId = z.uuid();
const idList = z.array(productId).max(LIMIT);

async function savedIds(userId: string) {
  const rows = await db()
    .select({ productId: s.wishlistItems.productId })
    .from(s.wishlistItems)
    .where(eq(s.wishlistItems.userId, userId))
    .orderBy(desc(s.wishlistItems.createdAt))
    .limit(LIMIT);
  return visibleProductIds(rows.map((row) => row.productId));
}

async function save(userId: string, ids: string[]) {
  if (!ids.length) return;
  await db()
    .insert(s.wishlistItems)
    .values(ids.map((id) => ({ userId, productId: id })))
    .onConflictDoNothing();
}

/**
 * Signed-in shoppers keep their wishlist on the server; guests keep theirs in
 * the browser and hand it over (`/merge`) when they sign in.
 */
export async function wishlistRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSameOrigin);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
  });

  // Always 200, so the storefront can ask on every page without logging errors for guests.
  app.get("/", async (request) => {
    const viewer = await currentUser(request);
    return viewer
      ? { signedIn: true, ids: await savedIds(viewer.id) }
      : { signedIn: false, ids: [] };
  });

  /** Cards for a list of product ids — public, so guests' saved items can be shown too. */
  app.get<{ Querystring: { ids?: string } }>("/products", async (request, reply) => {
    const ids = idList.safeParse((request.query.ids ?? "").split(",").filter(Boolean));
    if (!ids.success) return reply.status(400).send({ error: "Invalid product list." });
    return visibleSummaries(ids.data);
  });

  app.register(async (signedIn) => {
    signedIn.addHook("preHandler", requireUser);

    signedIn.put<{ Params: { productId: string } }>("/items/:productId", async (request, reply) => {
      const id = productId.safeParse(request.params.productId);
      if (!id.success) return reply.status(400).send({ error: "Invalid product." });
      const [live] = await visibleProductIds([id.data]);
      if (!live) return reply.status(404).send({ error: "This product is no longer available." });
      await save(request.viewer!.id, [live]);
      return { ids: await savedIds(request.viewer!.id) };
    });

    signedIn.delete<{ Params: { productId: string } }>(
      "/items/:productId",
      async (request, reply) => {
        const id = productId.safeParse(request.params.productId);
        if (!id.success) return reply.status(400).send({ error: "Invalid product." });
        await db()
          .delete(s.wishlistItems)
          .where(
            and(
              eq(s.wishlistItems.userId, request.viewer!.id),
              eq(s.wishlistItems.productId, id.data),
            ),
          );
        return { ids: await savedIds(request.viewer!.id) };
      },
    );

    /** A guest's browser list, added to the account on sign-in. */
    signedIn.post<{ Body: unknown }>("/merge", async (request, reply) => {
      const body = z.object({ ids: idList }).safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: "Invalid product list." });
      await save(request.viewer!.id, await visibleProductIds(body.data.ids));
      return { ids: await savedIds(request.viewer!.id) };
    });
  });
}
