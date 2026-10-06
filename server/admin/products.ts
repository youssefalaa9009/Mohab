import { and, asc, count, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import type {
  AdminImage,
  AdminProductDetail,
  AdminProductList,
  ProductStatus,
  StockMovement,
} from "../../src/features/admin/types.js";
import { slugify } from "../catalog/repository.js";
import { db } from "../db/client.js";
import { isUniqueViolation } from "../db/errors.js";
import * as s from "../db/schema/index.js";
import { deleteStoredImage, type StoredImage } from "../media/storage.js";

export class ProductAdminError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

const PAGE_SIZE = 30;

function toAdminImage(row: typeof s.productImages.$inferSelect): AdminImage {
  return {
    id: row.id,
    key: row.key,
    alt: row.alt,
    width: row.width,
    height: row.height,
    role: row.role,
    position: row.position,
    colorId: row.colorId,
  };
}

/* ─── Reads ───────────────────────────────────────────────────────────────── */

export async function listAdminProducts(options: {
  query?: string;
  status?: ProductStatus;
  page: number;
}): Promise<AdminProductList> {
  const conditions: SQL[] = [];
  if (options.status) conditions.push(eq(s.products.status, options.status));
  if (options.query) {
    const term = `%${options.query.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(
      sql`(${ilike(s.products.name, term)} or exists (
        select 1 from variants where variants.product_id = "products"."id" and variants.sku ilike ${term}
      ))`,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [total]] = await Promise.all([
    db()
      .select({
        id: s.products.id,
        name: s.products.name,
        slug: s.products.slug,
        status: s.products.status,
        categoryName: s.categories.name,
        isDemo: s.products.isDemo,
        updatedAt: s.products.updatedAt,
        minPrice: sql<
          number | null
        >`(select min(variants.price) from variants where variants.product_id = "products"."id" and variants.is_active)`,
        maxPrice: sql<
          number | null
        >`(select max(variants.price) from variants where variants.product_id = "products"."id" and variants.is_active)`,
        totalStock: sql<number>`(select coalesce(sum(variants.stock), 0)::int from variants where variants.product_id = "products"."id" and variants.is_active)`,
        variantCount: sql<number>`(select count(*)::int from variants where variants.product_id = "products"."id")`,
      })
      .from(s.products)
      .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
      .where(where)
      .orderBy(desc(s.products.updatedAt))
      .limit(PAGE_SIZE)
      .offset((options.page - 1) * PAGE_SIZE),
    db().select({ total: count() }).from(s.products).where(where),
  ]);

  const ids = rows.map((row) => row.id);
  const images = ids.length
    ? await db()
        .select()
        .from(s.productImages)
        .where(inArray(s.productImages.productId, ids))
        .orderBy(asc(s.productImages.position))
    : [];

  return {
    products: rows.map((row) => {
      const image =
        images.find((img) => img.productId === row.id && img.role === "primary") ??
        images.find((img) => img.productId === row.id);
      return {
        ...row,
        updatedAt: row.updatedAt.toISOString(),
        image: image ? toAdminImage(image) : null,
      };
    }),
    total: total?.total ?? 0,
    page: options.page,
    pageCount: Math.max(1, Math.ceil((total?.total ?? 0) / PAGE_SIZE)),
  };
}

export async function adminProductDetail(id: string): Promise<AdminProductDetail | null> {
  const [product] = await db().select().from(s.products).where(eq(s.products.id, id)).limit(1);
  if (!product) return null;

  const [colors, images, variants, links, options] = await Promise.all([
    db()
      .select()
      .from(s.productColors)
      .where(eq(s.productColors.productId, id))
      .orderBy(asc(s.productColors.position)),
    db()
      .select()
      .from(s.productImages)
      .where(eq(s.productImages.productId, id))
      .orderBy(asc(s.productImages.position)),
    db().select().from(s.variants).where(eq(s.variants.productId, id)).orderBy(asc(s.variants.sku)),
    db()
      .select({ collectionId: s.productCollections.collectionId })
      .from(s.productCollections)
      .where(eq(s.productCollections.productId, id)),
    productOptions(),
  ]);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    material: product.material,
    fit: product.fit,
    care: product.care,
    tags: product.tags,
    categoryId: product.categoryId,
    gender: product.gender,
    status: product.status,
    isFeatured: product.isFeatured,
    merchRank: product.merchRank,
    publishedAt: product.publishedAt?.toISOString() ?? null,
    sizeChartId: product.sizeChartId,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    isDemo: product.isDemo,
    collectionIds: links.map((link) => link.collectionId),
    colors: colors.map(({ id: colorId, name, hex, position }) => ({
      id: colorId,
      name,
      hex,
      position,
    })),
    images: images.map(toAdminImage),
    variants: variants.map((variant) => ({
      id: variant.id,
      colorId: variant.colorId,
      size: variant.size,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      stock: variant.stock,
      isActive: variant.isActive,
    })),
    options,
  };
}

/** Choices for the product form's selects. */
export async function productOptions(): Promise<AdminProductDetail["options"]> {
  const [categories, collections, sizeCharts] = await Promise.all([
    db()
      .select({ id: s.categories.id, name: s.categories.name })
      .from(s.categories)
      .orderBy(asc(s.categories.position)),
    db()
      .select({ id: s.collections.id, name: s.collections.name })
      .from(s.collections)
      .orderBy(asc(s.collections.position)),
    db()
      .select({ id: s.sizeCharts.id, name: s.sizeCharts.name })
      .from(s.sizeCharts)
      .orderBy(asc(s.sizeCharts.name)),
  ]);
  return { categories, collections, sizeCharts };
}

export async function stockHistory(variantId: string): Promise<StockMovement[]> {
  const rows = await db()
    .select({
      delta: s.inventoryMovements.delta,
      reason: s.inventoryMovements.reason,
      note: s.inventoryMovements.note,
      orderNumber: s.orders.number,
      actor: s.user.name,
      createdAt: s.inventoryMovements.createdAt,
    })
    .from(s.inventoryMovements)
    .leftJoin(s.orders, eq(s.inventoryMovements.orderId, s.orders.id))
    .leftJoin(s.user, eq(s.inventoryMovements.actorId, s.user.id))
    .where(eq(s.inventoryMovements.variantId, variantId))
    .orderBy(desc(s.inventoryMovements.createdAt))
    .limit(50);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/* ─── Products ────────────────────────────────────────────────────────────── */

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "product";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const [clash] = await db()
      .select({ id: s.products.id })
      .from(s.products)
      .where(eq(s.products.slug, candidate))
      .limit(1);
    if (!clash || clash.id === excludeId) return candidate;
  }
  throw new ProductAdminError("Couldn’t find a free URL for this product name.");
}

export type ProductInput = {
  name: string;
  slug?: string | undefined;
  description?: string | null | undefined;
  material?: string | null | undefined;
  fit?: string | null | undefined;
  care?: string | null | undefined;
  tags?: string[] | undefined;
  categoryId: string;
  gender: "men" | "women" | "unisex";
  status?: ProductStatus | undefined;
  isFeatured?: boolean | undefined;
  merchRank?: number | undefined;
  sizeChartId?: string | null | undefined;
  seoTitle?: string | null | undefined;
  seoDescription?: string | null | undefined;
  collectionIds?: string[] | undefined;
};

export async function createProduct(input: ProductInput) {
  const slug = await uniqueSlug(input.slug || input.name);
  const [product] = await db()
    .insert(s.products)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      material: input.material ?? null,
      fit: input.fit ?? null,
      care: input.care ?? null,
      tags: input.tags ?? [],
      categoryId: input.categoryId,
      gender: input.gender,
      // New products always start as drafts: nothing goes live by accident.
      status: "draft",
    })
    .returning({ id: s.products.id });
  if (input.collectionIds?.length) await setCollections(product!.id, input.collectionIds);
  return product!.id;
}

async function setCollections(productId: string, collectionIds: string[]) {
  await db().delete(s.productCollections).where(eq(s.productCollections.productId, productId));
  if (collectionIds.length) {
    await db()
      .insert(s.productCollections)
      .values(
        collectionIds.map((collectionId, position) => ({ productId, collectionId, position })),
      );
  }
}

export async function updateProduct(id: string, input: ProductInput) {
  const [existing] = await db().select().from(s.products).where(eq(s.products.id, id)).limit(1);
  if (!existing) throw new ProductAdminError("Product not found.", 404);

  const status = input.status ?? existing.status;
  if (status === "active") {
    // A live product must be buyable: at least one active variant with a price.
    const [sellable] = await db()
      .select({ total: count() })
      .from(s.variants)
      .where(
        and(
          eq(s.variants.productId, id),
          eq(s.variants.isActive, true),
          sql`${s.variants.price} > 0`,
        ),
      );
    if (!sellable?.total) {
      throw new ProductAdminError(
        "Add at least one active variant with a price before publishing.",
      );
    }
  }

  const slug =
    input.slug && input.slug !== existing.slug ? await uniqueSlug(input.slug, id) : existing.slug;
  await db()
    .update(s.products)
    .set({
      name: input.name,
      slug,
      description: input.description ?? null,
      material: input.material ?? null,
      fit: input.fit ?? null,
      care: input.care ?? null,
      tags: input.tags ?? existing.tags,
      categoryId: input.categoryId,
      gender: input.gender,
      status,
      isFeatured: input.isFeatured ?? existing.isFeatured,
      merchRank: input.merchRank ?? existing.merchRank,
      sizeChartId: input.sizeChartId === undefined ? existing.sizeChartId : input.sizeChartId,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      // First time it goes live, it becomes "new" from today.
      publishedAt: status === "active" && !existing.publishedAt ? new Date() : existing.publishedAt,
    })
    .where(eq(s.products.id, id));
  if (input.collectionIds) await setCollections(id, input.collectionIds);
}

/* ─── Colours & variants ──────────────────────────────────────────────────── */

export async function addColor(productId: string, name: string, hex: string | null) {
  const [last] = await db()
    .select({ position: s.productColors.position })
    .from(s.productColors)
    .where(eq(s.productColors.productId, productId))
    .orderBy(desc(s.productColors.position))
    .limit(1);
  try {
    await db()
      .insert(s.productColors)
      .values({ productId, name, hex, position: (last?.position ?? -1) + 1 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ProductAdminError(`This product already has a colour called “${name}”.`);
    }
    throw error;
  }
}

export async function deleteColor(productId: string, colorId: string) {
  const [used] = await db()
    .select({ total: count() })
    .from(s.variants)
    .where(eq(s.variants.colorId, colorId));
  if (used?.total) {
    throw new ProductAdminError(
      "This colour has variants. Deactivate them instead — deleting would erase their stock history.",
    );
  }
  await db()
    .delete(s.productColors)
    .where(and(eq(s.productColors.id, colorId), eq(s.productColors.productId, productId)));
}

/** Create every missing colour × size combination, with generated SKUs. */
export async function generateVariants(
  productId: string,
  colorIds: (string | null)[],
  sizes: (string | null)[],
  price: number,
) {
  const [product] = await db()
    .select({ slug: s.products.slug })
    .from(s.products)
    .where(eq(s.products.id, productId))
    .limit(1);
  if (!product) throw new ProductAdminError("Product not found.", 404);

  const [colors, existing] = await Promise.all([
    db().select().from(s.productColors).where(eq(s.productColors.productId, productId)),
    db()
      .select({ colorId: s.variants.colorId, size: s.variants.size })
      .from(s.variants)
      .where(eq(s.variants.productId, productId)),
  ]);
  const has = new Set(existing.map((row) => `${row.colorId}|${row.size}`));
  const code = (value: string) => slugify(value).toUpperCase().slice(0, 12);

  const rows: (typeof s.variants.$inferInsert)[] = [];
  for (const colorId of colorIds) {
    const color = colors.find((item) => item.id === colorId);
    if (colorId && !color) throw new ProductAdminError("Unknown colour.");
    for (const size of sizes) {
      if (has.has(`${colorId}|${size}`)) continue;
      const parts = [code(product.slug), color && code(color.name), size && code(size)].filter(
        Boolean,
      );
      rows.push({ productId, colorId, size, sku: parts.join("-"), price, stock: 0 });
    }
  }
  if (!rows.length) throw new ProductAdminError("Those variants already exist.");

  // SKUs must be unique store-wide; suffix any that collide with another product's.
  const clashes = await db()
    .select({ sku: s.variants.sku })
    .from(s.variants)
    .where(
      inArray(
        s.variants.sku,
        rows.map((row) => row.sku),
      ),
    );
  const taken = new Set(clashes.map((row) => row.sku));
  for (const row of rows) {
    let suffix = 2;
    const base = row.sku;
    while (taken.has(row.sku)) row.sku = `${base}-${suffix++}`;
    taken.add(row.sku);
  }

  await db().insert(s.variants).values(rows);
  return rows.length;
}

export async function updateVariant(
  variantId: string,
  input: { price: number; compareAtPrice: number | null; sku: string; isActive: boolean },
) {
  if (input.compareAtPrice !== null && input.compareAtPrice <= input.price) {
    throw new ProductAdminError("The compare-at price must be higher than the price.");
  }
  try {
    const updated = await db()
      .update(s.variants)
      .set(input)
      .where(eq(s.variants.id, variantId))
      .returning({ id: s.variants.id });
    if (!updated.length) throw new ProductAdminError("Variant not found.", 404);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ProductAdminError("That SKU is already used by another variant.");
    }
    throw error;
  }
}

/**
 * Change stock through the ledger: every unit that appears or disappears has
 * a reason, an author and a time.
 */
export async function adjustStock(
  variantId: string,
  input: {
    mode: "add" | "set";
    quantity: number;
    reason: "restock" | "adjustment";
    note: string | null;
  },
  actorId: string,
) {
  await db().transaction(async (tx) => {
    const [variant] = await tx
      .select({ stock: s.variants.stock })
      .from(s.variants)
      .where(eq(s.variants.id, variantId))
      .for("update")
      .limit(1);
    if (!variant) throw new ProductAdminError("Variant not found.", 404);

    const next = input.mode === "set" ? input.quantity : variant.stock + input.quantity;
    if (next < 0) throw new ProductAdminError("Stock can’t go below zero.");
    const delta = next - variant.stock;
    if (delta === 0) return;

    await tx.update(s.variants).set({ stock: next }).where(eq(s.variants.id, variantId));
    await tx.insert(s.inventoryMovements).values({
      variantId,
      delta,
      reason: input.reason,
      note: input.note,
      actorId,
    });
  });
}

/* ─── Images ──────────────────────────────────────────────────────────────── */

export async function addImage(
  productId: string,
  stored: StoredImage,
  input: { alt: string; colorId: string | null },
) {
  const existing = await db()
    .select({
      role: s.productImages.role,
      position: s.productImages.position,
      colorId: s.productImages.colorId,
    })
    .from(s.productImages)
    .where(eq(s.productImages.productId, productId));
  const sameColor = existing.filter((image) => image.colorId === input.colorId);
  // First photo of a colour becomes its primary, the second its hover shot.
  const role = !sameColor.some((image) => image.role === "primary")
    ? "primary"
    : !sameColor.some((image) => image.role === "hover")
      ? "hover"
      : "gallery";
  await db()
    .insert(s.productImages)
    .values({
      productId,
      colorId: input.colorId,
      key: stored.key,
      alt: input.alt,
      width: stored.width,
      height: stored.height,
      role,
      position: Math.max(-1, ...existing.map((image) => image.position)) + 1,
    });
}

export async function updateImage(
  productId: string,
  imageId: string,
  input: { alt: string; role: AdminImage["role"]; colorId: string | null; position: number },
) {
  await db().transaction(async (tx) => {
    // Only one primary and one hover image per colour.
    if (input.role !== "gallery") {
      await tx
        .update(s.productImages)
        .set({ role: "gallery" })
        .where(
          and(
            eq(s.productImages.productId, productId),
            eq(s.productImages.role, input.role),
            input.colorId === null
              ? sql`${s.productImages.colorId} is null`
              : eq(s.productImages.colorId, input.colorId),
          ),
        );
    }
    await tx
      .update(s.productImages)
      .set(input)
      .where(and(eq(s.productImages.id, imageId), eq(s.productImages.productId, productId)));
  });
}

export async function deleteImage(productId: string, imageId: string) {
  const [image] = await db()
    .delete(s.productImages)
    .where(and(eq(s.productImages.id, imageId), eq(s.productImages.productId, productId)))
    .returning({ key: s.productImages.key });
  if (!image) return;
  // Past orders snapshot the photo they were sold with; keep the files they still show.
  const [referenced] = await db()
    .select({ total: count() })
    .from(s.orderItems)
    .where(eq(s.orderItems.imageKey, image.key));
  if (!referenced?.total) await deleteStoredImage(image.key);
}
