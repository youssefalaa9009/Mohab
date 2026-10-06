import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { SORT_OPTIONS } from "../../src/features/catalog/types.js";
import {
  PAGE_SIZE,
  collectionSummaries,
  getCategory,
  getCollection,
  getProduct,
  homeData,
  listProducts,
  navData,
} from "../catalog/repository.js";
import { searchCatalog } from "../catalog/search.js";

/** "a,b,c" → ["a","b","c"]; caps the list so one URL can't build a giant query. */
const csv = z
  .string()
  .max(500)
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 50),
  );

const slug = z.string().regex(/^[a-z0-9-]{1,120}$/);

/** Prices travel in whole currency units in URLs (EGP 1,500 → 1500) and are stored in minor units. */
const wholeUnits = z.coerce
  .number()
  .int()
  .min(0)
  .max(10_000_000)
  .transform((value) => value * 100);

const listQuerySchema = z.object({
  scopeCategory: slug.optional(),
  gender: z.enum(["men", "women"]).optional(),
  collection: slug.optional(),
  new: z.literal("1").optional(),
  category: csv.optional(),
  size: csv.optional(),
  color: csv.optional(),
  minPrice: wholeUnits.optional(),
  maxPrice: wholeUnits.optional(),
  inStock: z.literal("1").optional(),
  slugs: csv.optional(),
  // Product ids: validated here so a malformed value is a 400, not a database error.
  exclude: csv.pipe(z.array(z.uuid())).optional(),
  sort: z
    .enum(SORT_OPTIONS.map((option) => option.value) as [string, ...string[]])
    .default("featured"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE).optional(),
});

function badRequest(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({
    error: "Invalid query",
    issues: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  });
}

function notFound(reply: FastifyReply, what: string) {
  return reply.status(404).send({ error: `${what} not found` });
}

export async function catalogRoutes(app: FastifyInstance) {
  // Catalog reads are public and identical for every visitor: let browsers and the
  // CDN reuse them briefly, and serve a stale copy while revalidating.
  app.addHook("onSend", async (request, reply) => {
    if (request.method === "GET" && reply.statusCode === 200) {
      reply.header("cache-control", "public, max-age=30, stale-while-revalidate=300");
    }
  });

  app.get("/products", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const q = parsed.data;

    return listProducts({
      scope: {
        category: q.scopeCategory,
        gender: q.gender,
        collection: q.collection,
        newOnly: q.new === "1",
      },
      filters: {
        categories: q.category,
        sizes: q.size,
        colors: q.color,
        minPrice: q.minPrice,
        maxPrice: q.maxPrice,
        inStock: q.inStock === "1",
        slugs: q.slugs,
        excludeIds: q.exclude,
      },
      sort: q.sort as (typeof SORT_OPTIONS)[number]["value"],
      page: q.page,
      pageSize: q.pageSize,
    });
  });

  app.get<{ Params: { slug: string } }>("/products/:slug", async (request, reply) => {
    const parsed = slug.safeParse(request.params.slug);
    if (!parsed.success) return notFound(reply, "Product");
    const product = await getProduct(parsed.data);
    return product ?? notFound(reply, "Product");
  });

  app.get<{ Params: { slug: string } }>("/categories/:slug", async (request, reply) => {
    const parsed = slug.safeParse(request.params.slug);
    if (!parsed.success) return notFound(reply, "Category");
    const category = await getCategory(parsed.data);
    return category ?? notFound(reply, "Category");
  });

  app.get("/collections", async () => collectionSummaries());

  app.get<{ Params: { slug: string } }>("/collections/:slug", async (request, reply) => {
    const parsed = slug.safeParse(request.params.slug);
    if (!parsed.success) return notFound(reply, "Collection");
    const collection = await getCollection(parsed.data);
    return collection ?? notFound(reply, "Collection");
  });

  app.get("/nav", async () => navData());

  /** Full results page. */
  app.get("/search", async (request) => {
    const q = z.object({ q: z.string().max(100).default("") }).safeParse(request.query);
    return searchCatalog(q.success ? q.data.q : "", 48);
  });

  /** As-you-type suggestions in the search overlay: small and fast. */
  app.get("/search/suggest", async (request) => {
    const q = z.object({ q: z.string().max(100).default("") }).safeParse(request.query);
    return searchCatalog(q.success ? q.data.q : "", 6);
  });
  app.get("/home", async () => homeData());
}
