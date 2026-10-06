import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  ProductAdminError,
  addColor,
  addImage,
  adjustStock,
  adminProductDetail,
  createProduct,
  deleteColor,
  deleteImage,
  generateVariants,
  listAdminProducts,
  productOptions,
  stockHistory,
  updateImage,
  updateProduct,
  updateVariant,
} from "../admin/products.js";
import { requireAdmin } from "../auth.js";
import { requireSameOrigin } from "../http/security.js";
import { MediaError, storeProductImage } from "../media/storage.js";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const id = z.uuid();
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);
/** Prices travel as whole currency units from the form and are stored in minor units. */
const money = z
  .number()
  .min(0)
  .max(10_000_000)
  .transform((value) => Math.round(value * 100));

const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens.")
    .optional(),
  description: text(5000),
  material: text(500),
  fit: text(500),
  care: text(1000),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  categoryId: id,
  gender: z.enum(["men", "women", "unisex"]),
  status: z.enum(["draft", "active", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  merchRank: z.number().int().min(0).max(10_000).optional(),
  sizeChartId: id.nullable().optional(),
  seoTitle: text(70),
  seoDescription: text(170),
  collectionIds: z.array(id).max(20).optional(),
});

function failure(reply: FastifyReply, error: unknown) {
  if (error instanceof ProductAdminError || error instanceof MediaError) {
    return reply
      .status(error instanceof ProductAdminError ? error.status : 422)
      .send({ error: error.message });
  }
  throw error;
}

function invalid(reply: FastifyReply, error: z.ZodError) {
  const issue = error.issues[0];
  return reply.status(400).send({
    error: issue ? `${issue.path.join(".") || "Request"}: ${issue.message}` : "Invalid request.",
  });
}

export async function adminProductRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
  });
  // Multipart uploads can't be JSON; the origin check still applies to them.
  app.addHook("preHandler", async (request, reply) => {
    if (request.isMultipart()) {
      const origin = request.headers.origin;
      if (origin && new URL(origin).host !== request.host) {
        return reply.status(403).send({ error: "Cross-site request blocked." });
      }
      return;
    }
    return requireSameOrigin(request, reply);
  });
  app.addHook("preHandler", requireAdmin);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
  });

  app.get("/", async (request, reply) => {
    const query = z
      .object({
        q: z.string().trim().max(100).optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
        page: z.coerce.number().int().min(1).max(10_000).default(1),
      })
      .safeParse(request.query);
    if (!query.success) return invalid(reply, query.error);
    return listAdminProducts({
      query: query.data.q || undefined,
      status: query.data.status,
      page: query.data.page,
    });
  });

  app.get("/options", async () => productOptions());

  app.post("/", async (request, reply) => {
    const body = productSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error);
    try {
      return reply.status(201).send({ id: await createProduct(body.data) });
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.get<{ Params: { productId: string } }>("/:productId", async (request, reply) => {
    const productId = id.safeParse(request.params.productId);
    const product = productId.success ? await adminProductDetail(productId.data) : null;
    return product ?? reply.status(404).send({ error: "Product not found." });
  });

  app.put<{ Params: { productId: string } }>("/:productId", async (request, reply) => {
    const productId = id.safeParse(request.params.productId);
    const body = productSchema.safeParse(request.body);
    if (!productId.success) return reply.status(404).send({ error: "Product not found." });
    if (!body.success) return invalid(reply, body.error);
    try {
      await updateProduct(productId.data, body.data);
      return adminProductDetail(productId.data);
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.post<{ Params: { productId: string } }>("/:productId/colors", async (request, reply) => {
    const productId = id.safeParse(request.params.productId);
    const body = z
      .object({
        name: z.string().trim().min(1).max(60),
        hex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
      })
      .safeParse(request.body);
    if (!productId.success || !body.success)
      return reply.status(400).send({ error: "Enter a colour name." });
    try {
      await addColor(productId.data, body.data.name, body.data.hex ?? null);
      return adminProductDetail(productId.data);
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.delete<{ Params: { productId: string; colorId: string } }>(
    "/:productId/colors/:colorId",
    async (request, reply) => {
      const productId = id.safeParse(request.params.productId);
      const colorId = id.safeParse(request.params.colorId);
      if (!productId.success || !colorId.success)
        return reply.status(404).send({ error: "Not found." });
      try {
        await deleteColor(productId.data, colorId.data);
        return adminProductDetail(productId.data);
      } catch (error) {
        return failure(reply, error);
      }
    },
  );

  app.post<{ Params: { productId: string } }>("/:productId/variants", async (request, reply) => {
    const productId = id.safeParse(request.params.productId);
    const body = z
      .object({
        colorIds: z.array(id.nullable()).min(1).max(30),
        sizes: z.array(z.string().trim().min(1).max(20).nullable()).min(1).max(30),
        price: money,
      })
      .safeParse(request.body);
    if (!productId.success) return reply.status(404).send({ error: "Product not found." });
    if (!body.success) return invalid(reply, body.error);
    try {
      await generateVariants(productId.data, body.data.colorIds, body.data.sizes, body.data.price);
      return adminProductDetail(productId.data);
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.put<{ Params: { productId: string; variantId: string } }>(
    "/:productId/variants/:variantId",
    async (request, reply) => {
      const productId = id.safeParse(request.params.productId);
      const variantId = id.safeParse(request.params.variantId);
      const body = z
        .object({
          price: money,
          compareAtPrice: money.nullable(),
          sku: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .regex(/^[A-Za-z0-9-_]+$/, "Letters, numbers, - and _ only."),
          isActive: z.boolean(),
        })
        .safeParse(request.body);
      if (!productId.success || !variantId.success)
        return reply.status(404).send({ error: "Not found." });
      if (!body.success) return invalid(reply, body.error);
      try {
        await updateVariant(variantId.data, body.data);
        return adminProductDetail(productId.data);
      } catch (error) {
        return failure(reply, error);
      }
    },
  );

  app.post<{ Params: { productId: string; variantId: string } }>(
    "/:productId/variants/:variantId/stock",
    async (request, reply) => {
      const productId = id.safeParse(request.params.productId);
      const variantId = id.safeParse(request.params.variantId);
      const body = z
        .object({
          mode: z.enum(["add", "set"]),
          quantity: z.number().int().min(-100_000).max(100_000),
          reason: z.enum(["restock", "adjustment"]),
          note: text(300),
        })
        .safeParse(request.body);
      if (!productId.success || !variantId.success)
        return reply.status(404).send({ error: "Not found." });
      if (!body.success) return invalid(reply, body.error);
      try {
        await adjustStock(variantId.data, body.data, request.viewer!.id);
        return adminProductDetail(productId.data);
      } catch (error) {
        return failure(reply, error);
      }
    },
  );

  app.get<{ Params: { productId: string; variantId: string } }>(
    "/:productId/variants/:variantId/history",
    async (request, reply) => {
      const variantId = id.safeParse(request.params.variantId);
      if (!variantId.success) return reply.status(404).send({ error: "Not found." });
      return stockHistory(variantId.data);
    },
  );

  app.post<{ Params: { productId: string } }>("/:productId/images", async (request, reply) => {
    const productId = id.safeParse(request.params.productId);
    if (!productId.success) return reply.status(404).send({ error: "Product not found." });
    // Read every part, whatever the order: request.file() stops at the first
    // file, so text fields placed after the file input would never be seen.
    let buffer: Buffer | null = null;
    let truncated = false;
    const fields: Record<string, string> = {};
    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          const data = await part.toBuffer();
          if (!buffer) {
            buffer = data;
            truncated = part.file.truncated;
          }
        } else {
          fields[part.fieldname] = String(part.value ?? "");
        }
      }
    } catch (error) {
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        return reply.status(413).send({ error: "Images must be under 20 MB." });
      }
      throw error;
    }
    if (!buffer) return reply.status(400).send({ error: "Choose an image to upload." });
    if (truncated) return reply.status(413).send({ error: "Images must be under 20 MB." });

    const alt = (fields.alt ?? "").trim();
    const colorId = fields.colorId || null;
    if (alt.length < 3) {
      return reply.status(400).send({ error: "Describe the image (alt text) for screen readers." });
    }
    if (colorId && !id.safeParse(colorId).success) {
      return reply.status(400).send({ error: "Unknown colour." });
    }

    try {
      const stored = await storeProductImage(buffer);
      await addImage(productId.data, stored, { alt: alt.slice(0, 200), colorId });
      return adminProductDetail(productId.data);
    } catch (error) {
      return failure(reply, error);
    }
  });

  app.put<{ Params: { productId: string; imageId: string } }>(
    "/:productId/images/:imageId",
    async (request, reply) => {
      const productId = id.safeParse(request.params.productId);
      const imageId = id.safeParse(request.params.imageId);
      const body = z
        .object({
          alt: z.string().trim().min(3).max(200),
          role: z.enum(["primary", "hover", "gallery"]),
          colorId: id.nullable(),
          position: z.number().int().min(0).max(1000),
        })
        .safeParse(request.body);
      if (!productId.success || !imageId.success)
        return reply.status(404).send({ error: "Not found." });
      if (!body.success) return invalid(reply, body.error);
      await updateImage(productId.data, imageId.data, body.data);
      return adminProductDetail(productId.data);
    },
  );

  app.delete<{ Params: { productId: string; imageId: string } }>(
    "/:productId/images/:imageId",
    async (request, reply) => {
      const productId = id.safeParse(request.params.productId);
      const imageId = id.safeParse(request.params.imageId);
      if (!productId.success || !imageId.success)
        return reply.status(404).send({ error: "Not found." });
      await deleteImage(productId.data, imageId.data);
      return adminProductDetail(productId.data);
    },
  );
}
