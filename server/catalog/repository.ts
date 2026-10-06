import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  ne,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type {
  CategorySummary,
  CollectionSummary,
  ColorDetail,
  ColorSummary,
  Facets,
  HomeData,
  ImageRef,
  NavData,
  ProductDetail,
  ProductListResponse,
  ProductSummary,
  SortValue,
  StockLevel,
  VariantInfo,
} from "../../src/features/catalog/types.js";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";

export const PAGE_SIZE = 24;
/** Products published within this window carry the "New" badge. */
const NEW_WINDOW_DAYS = 30;
/** At or below this many units a variant is reported as low stock. */
const LOW_STOCK_THRESHOLD = 3;
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "3XL", "4XL"];

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function compareSizes(a: string, b: string) {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase());
  const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  // Numeric sizes (waist 30, 32 …) sort numerically; anything else alphabetically.
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
}

/* ─── Shared SQL fragments ─────────────────────────────────────────────────── */

/** Live on the storefront: active and already published. */
const isVisible = and(
  eq(s.products.status, "active"),
  isNotNull(s.products.publishedAt),
  lte(s.products.publishedAt, sql`now()`),
)!;

/*
 * Correlated subqueries spell out the outer table ("products"."id") by hand:
 * Drizzle drops table qualifiers when the outer query has a single table, so
 * ${s.products.id} would silently bind to the inner table instead.
 */
const minPriceExpr = sql<number>`(
  select min(variants.price) from variants
  where variants.product_id = "products"."id" and variants.is_active
)`;

/** Units sold through orders that were actually confirmed — never a manual flag. */
const unitsSoldExpr = sql<number>`coalesce((
  select sum(order_items.quantity) from order_items
  inner join orders on orders.id = order_items.order_id
  where order_items.product_id = "products"."id"
    and orders.status in ('confirmed', 'processing', 'shipped', 'delivered')
), 0)`;

function genderCondition(gender: "men" | "women"): SQL {
  return inArray(s.products.gender, [gender, "unisex"]);
}

function inCollection(collectionSlug: string): SQL {
  return sql`exists (
    select 1 from product_collections
    inner join collections on collections.id = product_collections.collection_id
    where product_collections.product_id = "products"."id"
      and collections.slug = ${collectionSlug}
      and collections.is_active
  )`;
}

/** `condition` may reference variants columns; the subquery reads the real table, unaliased. */
function hasVariantWhere(condition: SQL): SQL {
  return sql`exists (
    select 1 from variants
    where variants.product_id = "products"."id" and variants.is_active and ${condition}
  )`;
}

/* ─── Product listing ─────────────────────────────────────────────────────── */

export type ListQuery = {
  /** Fixed by the page the shopper is on (e.g. /shop/hoodies, /men). Facets are computed within it. */
  scope: {
    category?: string | undefined;
    gender?: "men" | "women" | undefined;
    collection?: string | undefined;
    newOnly?: boolean | undefined;
  };
  /** Chosen by the shopper; narrows results but not the facet options. */
  filters: {
    categories?: string[] | undefined;
    sizes?: string[] | undefined;
    colors?: string[] | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    inStock?: boolean | undefined;
    slugs?: string[] | undefined;
    excludeIds?: string[] | undefined;
  };
  sort: SortValue;
  page: number;
  pageSize?: number;
};

function scopeConditions(scope: ListQuery["scope"]): SQL[] {
  const conditions: SQL[] = [isVisible];
  if (scope.category) conditions.push(eq(s.categories.slug, scope.category));
  if (scope.gender) conditions.push(genderCondition(scope.gender));
  if (scope.collection) conditions.push(inCollection(scope.collection));
  if (scope.newOnly) {
    conditions.push(
      gte(s.products.publishedAt, sql`now() - interval '${sql.raw(String(NEW_WINDOW_DAYS))} days'`),
    );
  }
  return conditions;
}

/** Colour filters arrive as slugs; resolve them to the stored names. */
async function colorNamesForSlugs(slugs: string[]): Promise<string[]> {
  if (!slugs.length) return [];
  const rows = await db().selectDistinct({ name: s.productColors.name }).from(s.productColors);
  const wanted = new Set(slugs);
  return rows.map((row) => row.name).filter((name) => wanted.has(slugify(name)));
}

async function filterConditions(filters: ListQuery["filters"]): Promise<SQL[]> {
  const conditions: SQL[] = [];
  if (filters.categories?.length) conditions.push(inArray(s.categories.slug, filters.categories));
  if (filters.sizes?.length)
    conditions.push(hasVariantWhere(inArray(s.variants.size, filters.sizes)));
  if (filters.colors?.length) {
    const names = await colorNamesForSlugs(filters.colors);
    // Unknown colour slugs must match nothing rather than be silently ignored.
    conditions.push(
      names.length
        ? sql`exists (
            select 1 from product_colors
            where product_colors.product_id = "products"."id"
              and ${inArray(s.productColors.name, names)}
          )`
        : sql`false`,
    );
  }
  if (filters.minPrice !== undefined) conditions.push(sql`${minPriceExpr} >= ${filters.minPrice}`);
  if (filters.maxPrice !== undefined) conditions.push(sql`${minPriceExpr} <= ${filters.maxPrice}`);
  if (filters.inStock) conditions.push(hasVariantWhere(sql`${s.variants.stock} > 0`));
  if (filters.slugs?.length) conditions.push(inArray(s.products.slug, filters.slugs));
  if (filters.excludeIds?.length) conditions.push(notInArray(s.products.id, filters.excludeIds));
  return conditions;
}

function orderFor(sort: SortValue) {
  switch (sort) {
    case "newest":
      return [desc(s.products.publishedAt)];
    case "price-asc":
      return [asc(minPriceExpr), desc(s.products.publishedAt)];
    case "price-desc":
      return [desc(minPriceExpr), desc(s.products.publishedAt)];
    case "best-selling":
      return [desc(unitsSoldExpr), desc(s.products.merchRank), desc(s.products.publishedAt)];
    case "featured":
    default:
      return [
        desc(s.products.isFeatured),
        desc(s.products.merchRank),
        desc(s.products.publishedAt),
      ];
  }
}

export async function listProducts(query: ListQuery): Promise<ProductListResponse> {
  const pageSize = query.pageSize ?? PAGE_SIZE;
  const scope = scopeConditions(query.scope);
  const where = and(...scope, ...(await filterConditions(query.filters)));

  const [countRow] = await db()
    .select({ total: sql<number>`count(*)::int` })
    .from(s.products)
    .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
    .where(where);
  const total = countRow?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);

  const rows = await db()
    .select({ id: s.products.id })
    .from(s.products)
    .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
    .where(where)
    .orderBy(...orderFor(query.sort))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [products, facets] = await Promise.all([
    summarize(rows.map((row) => row.id)),
    facetsFor(scope),
  ]);

  return { products, total, page, pageSize, pageCount, facets };
}

async function facetsFor(scope: SQL[]): Promise<Facets> {
  const where = and(...scope);

  const [categories, sizes, colors, price] = await Promise.all([
    db()
      .select({
        value: s.categories.slug,
        label: s.categories.name,
        count: sql<number>`count(distinct ${s.products.id})::int`,
      })
      .from(s.products)
      .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
      .where(where)
      .groupBy(s.categories.slug, s.categories.name, s.categories.position)
      .orderBy(asc(s.categories.position)),
    db()
      .selectDistinct({ size: s.variants.size })
      .from(s.variants)
      .innerJoin(s.products, eq(s.variants.productId, s.products.id))
      .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
      .where(and(where, s.variants.isActive, isNotNull(s.variants.size))),
    db()
      // One option per colour name: products may give "Stone" slightly different
      // swatches, but shoppers filter by name (one swatch is shown for the group).
      .select({
        name: sql<string>`min(${s.productColors.name})`,
        hex: sql<string | null>`min(${s.productColors.hex})`,
        count: sql<number>`count(distinct ${s.products.id})::int`,
      })
      .from(s.productColors)
      .innerJoin(s.products, eq(s.productColors.productId, s.products.id))
      .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
      .where(where)
      .groupBy(sql`lower(${s.productColors.name})`)
      .orderBy(sql`lower(${s.productColors.name})`),
    db()
      .select({
        min: sql<number | null>`min(${minPriceExpr})`,
        max: sql<number | null>`max(${minPriceExpr})`,
      })
      .from(s.products)
      .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
      .where(where),
  ]);

  const priceRow = price[0];
  return {
    categories,
    sizes: sizes
      .map((row) => row.size!)
      .sort(compareSizes)
      .map((size) => ({ value: size, label: size })),
    colors: colors.map((row) => ({
      value: slugify(row.name),
      label: row.name,
      count: row.count,
      hex: row.hex,
    })),
    price:
      priceRow?.min != null && priceRow.max != null
        ? { min: priceRow.min, max: priceRow.max }
        : null,
  };
}

/* ─── Summaries ───────────────────────────────────────────────────────────── */

type ImageRow = typeof s.productImages.$inferSelect;
type ColorRow = typeof s.productColors.$inferSelect;
type VariantRow = typeof s.variants.$inferSelect;

function toImage(row: ImageRow): ImageRef {
  return { key: row.key, alt: row.alt, width: row.width, height: row.height };
}

function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return "out";
  return stock <= LOW_STOCK_THRESHOLD ? "low" : "in";
}

function pickImage(images: ImageRow[], colorId: string | null, role: ImageRow["role"]) {
  return (
    images.find((image) => image.colorId === colorId && image.role === role) ??
    images.find((image) => image.colorId === null && image.role === role) ??
    null
  );
}

/** Load summaries for the given ids, preserving their order. */
export const summarizeProducts = (ids: string[]) => summarize(ids);

/** The subset of `ids` that is live on the storefront, in the order given. */
export async function visibleProductIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db()
    .select({ id: s.products.id })
    .from(s.products)
    .where(and(inArray(s.products.id, ids), isVisible));
  const live = new Set(rows.map((row) => row.id));
  return ids.filter((id) => live.has(id));
}

/** Cards for live products only, in the order given (wishlists, saved lists). */
export async function visibleSummaries(ids: string[]): Promise<ProductSummary[]> {
  const live = await visibleProductIds(ids);
  const byId = new Map((await summarize(live)).map((product) => [product.id, product]));
  return live.map((id) => byId.get(id)).filter((product) => product !== undefined);
}

async function summarize(ids: string[]): Promise<ProductSummary[]> {
  if (!ids.length) return [];

  const [productRows, colorRows, imageRows, variantRows] = await Promise.all([
    db()
      .select({
        id: s.products.id,
        slug: s.products.slug,
        name: s.products.name,
        gender: s.products.gender,
        publishedAt: s.products.publishedAt,
        categorySlug: s.categories.slug,
        categoryName: s.categories.name,
      })
      .from(s.products)
      .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
      .where(inArray(s.products.id, ids)),
    db()
      .select()
      .from(s.productColors)
      .where(inArray(s.productColors.productId, ids))
      .orderBy(asc(s.productColors.position)),
    db()
      .select()
      .from(s.productImages)
      .where(inArray(s.productImages.productId, ids))
      .orderBy(asc(s.productImages.position)),
    db()
      .select()
      .from(s.variants)
      .where(and(inArray(s.variants.productId, ids), eq(s.variants.isActive, true))),
  ]);

  const byProduct = <T extends { productId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) map.set(row.productId, [...(map.get(row.productId) ?? []), row]);
    return map;
  };
  const colorsBy = byProduct(colorRows);
  const imagesBy = byProduct(imageRows);
  const variantsBy = byProduct(variantRows);
  const newSince = Date.now() - NEW_WINDOW_DAYS * 86_400_000;

  const summaries = new Map<string, ProductSummary>();
  for (const product of productRows) {
    const colors = colorsBy.get(product.id) ?? [];
    const images = imagesBy.get(product.id) ?? [];
    const variants = variantsBy.get(product.id) ?? [];
    const firstColorId = colors[0]?.id ?? null;

    // The cheapest variant sets the displayed price (and its sale status).
    const cheapest = [...variants].sort((a, b) => a.price - b.price)[0];
    const primary = pickImage(images, firstColorId, "primary") ?? images[0] ?? null;
    const hover = pickImage(images, firstColorId, "hover");

    summaries.set(product.id, {
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: { slug: product.categorySlug, name: product.categoryName },
      gender: product.gender,
      price: { amount: cheapest?.price ?? 0, currency: cheapest?.currency ?? "EGP" },
      compareAtPrice:
        cheapest?.compareAtPrice != null
          ? { amount: cheapest.compareAtPrice, currency: cheapest.currency }
          : null,
      isNew: product.publishedAt != null && product.publishedAt.getTime() >= newSince,
      soldOut: !variants.some((variant) => variant.stock > 0),
      colors: colors.map((color) => toColorSummary(color, images)),
      primaryImage: primary ? toImage(primary) : null,
      hoverImage: hover && hover.id !== primary?.id ? toImage(hover) : null,
    });
  }

  return ids.map((id) => summaries.get(id)).filter((summary) => summary !== undefined);
}

function toColorSummary(color: ColorRow, images: ImageRow[]): ColorSummary {
  const image = pickImage(images, color.id, "primary");
  return {
    slug: slugify(color.name),
    name: color.name,
    hex: color.hex,
    image: image ? toImage(image) : null,
  };
}

/* ─── Product detail ──────────────────────────────────────────────────────── */

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  const [row] = await db()
    .select({ product: s.products, category: s.categories })
    .from(s.products)
    .innerJoin(s.categories, eq(s.products.categoryId, s.categories.id))
    .where(and(eq(s.products.slug, slug), isVisible))
    .limit(1);
  if (!row) return null;
  const { product } = row;

  const [summary] = await summarize([product.id]);
  if (!summary) return null;

  const [colors, images, variants, chart, collections] = await Promise.all([
    db()
      .select()
      .from(s.productColors)
      .where(eq(s.productColors.productId, product.id))
      .orderBy(asc(s.productColors.position)),
    db()
      .select()
      .from(s.productImages)
      .where(eq(s.productImages.productId, product.id))
      .orderBy(asc(s.productImages.position)),
    db()
      .select()
      .from(s.variants)
      .where(and(eq(s.variants.productId, product.id), eq(s.variants.isActive, true))),
    product.sizeChartId
      ? db().select().from(s.sizeCharts).where(eq(s.sizeCharts.id, product.sizeChartId)).limit(1)
      : Promise.resolve([]),
    db()
      .select({ slug: s.collections.slug, name: s.collections.name, id: s.collections.id })
      .from(s.productCollections)
      .innerJoin(s.collections, eq(s.productCollections.collectionId, s.collections.id))
      .where(and(eq(s.productCollections.productId, product.id), eq(s.collections.isActive, true))),
  ]);

  const colorSlugById = new Map(colors.map((color) => [color.id, slugify(color.name)]));
  const colorDetails: ColorDetail[] = colors.map((color) => ({
    slug: slugify(color.name),
    name: color.name,
    hex: color.hex,
    images: images.filter((image) => image.colorId === color.id).map(toImage),
  }));

  const sizes = [
    ...new Set(variants.map((variant) => variant.size).filter((size) => size !== null)),
  ].sort(compareSizes);

  const [related, completeTheLook] = await Promise.all([
    relatedProducts(product.id, product.categoryId),
    completeTheLookFor(
      product.id,
      product.categoryId,
      collections.map((c) => c.id),
    ),
  ]);

  const sizeChart = chart[0];
  return {
    ...summary,
    description: product.description,
    material: product.material,
    fit: product.fit,
    care: product.care,
    tags: product.tags,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    colorDetails,
    sharedImages: images.filter((image) => image.colorId === null).map(toImage),
    sizes,
    variants: variants.map((variant) => toVariantInfo(variant, colorSlugById)),
    sizeChart: sizeChart
      ? {
          name: sizeChart.name,
          unit: sizeChart.unit,
          columns: sizeChart.columns,
          rows: sizeChart.rows,
          notes: sizeChart.notes,
        }
      : null,
    collections: collections.map(({ slug: collectionSlug, name }) => ({
      slug: collectionSlug,
      name,
    })),
    related,
    completeTheLook,
  };
}

function toVariantInfo(variant: VariantRow, colorSlugById: Map<string, string>): VariantInfo {
  return {
    id: variant.id,
    colorSlug: variant.colorId ? (colorSlugById.get(variant.colorId) ?? null) : null,
    size: variant.size,
    sku: variant.sku,
    price: { amount: variant.price, currency: variant.currency },
    compareAtPrice:
      variant.compareAtPrice != null
        ? { amount: variant.compareAtPrice, currency: variant.currency }
        : null,
    stock: stockLevel(variant.stock),
  };
}

/** Same category — the plain "you may also like". Not personalised, and not claimed to be. */
async function relatedProducts(productId: string, categoryId: string) {
  const rows = await db()
    .select({ id: s.products.id })
    .from(s.products)
    .where(and(isVisible, eq(s.products.categoryId, categoryId), ne(s.products.id, productId)))
    .orderBy(desc(s.products.isFeatured), desc(s.products.merchRank), desc(s.products.publishedAt))
    .limit(4);
  return summarize(rows.map((row) => row.id));
}

/** Pieces from the same collection(s) but a different category. */
async function completeTheLookFor(productId: string, categoryId: string, collectionIds: string[]) {
  if (!collectionIds.length) return [];
  const rows = await db()
    .selectDistinct({ id: s.products.id, rank: s.products.merchRank })
    .from(s.products)
    .innerJoin(s.productCollections, eq(s.productCollections.productId, s.products.id))
    .where(
      and(
        isVisible,
        inArray(s.productCollections.collectionId, collectionIds),
        ne(s.products.id, productId),
        ne(s.products.categoryId, categoryId),
      ),
    )
    .orderBy(desc(s.products.merchRank))
    .limit(4);
  return summarize(rows.map((row) => row.id));
}

/* ─── Navigation, collections, home ───────────────────────────────────────── */

export async function categorySummaries(gender?: "men" | "women"): Promise<CategorySummary[]> {
  const productScope = gender ? and(isVisible, genderCondition(gender))! : isVisible;
  return db()
    .select({
      slug: s.categories.slug,
      name: s.categories.name,
      productCount: sql<number>`count(${s.products.id})::int`,
      imageKey: s.categories.imageKey,
    })
    .from(s.categories)
    .innerJoin(s.products, and(eq(s.products.categoryId, s.categories.id), productScope))
    .where(eq(s.categories.isActive, true))
    .groupBy(s.categories.slug, s.categories.name, s.categories.position, s.categories.imageKey)
    .orderBy(asc(s.categories.position));
}

export async function getCategory(slug: string) {
  const [category] = await db()
    .select({
      slug: s.categories.slug,
      name: s.categories.name,
      description: s.categories.description,
    })
    .from(s.categories)
    .where(and(eq(s.categories.slug, slug), eq(s.categories.isActive, true)))
    .limit(1);
  return category ?? null;
}

const collectionIsLive = and(
  eq(s.collections.isActive, true),
  sql`(${s.collections.startsAt} is null or ${s.collections.startsAt} <= now())`,
  sql`(${s.collections.endsAt} is null or ${s.collections.endsAt} > now())`,
)!;

export async function collectionSummaries(): Promise<CollectionSummary[]> {
  return db()
    .select({
      slug: s.collections.slug,
      name: s.collections.name,
      description: s.collections.description,
      heroImageKey: s.collections.heroImageKey,
      productCount: sql<number>`count(${s.products.id})::int`,
    })
    .from(s.collections)
    .innerJoin(s.productCollections, eq(s.productCollections.collectionId, s.collections.id))
    .innerJoin(s.products, and(eq(s.products.id, s.productCollections.productId), isVisible))
    .where(collectionIsLive)
    .groupBy(s.collections.id)
    .orderBy(asc(s.collections.position));
}

export async function getCollection(slug: string) {
  const [collection] = await db()
    .select({
      slug: s.collections.slug,
      name: s.collections.name,
      description: s.collections.description,
      heroImageKey: s.collections.heroImageKey,
    })
    .from(s.collections)
    .where(and(eq(s.collections.slug, slug), collectionIsLive))
    .limit(1);
  return collection ?? null;
}

export async function navData(): Promise<NavData> {
  const [categories, men, women, genders, collections] = await Promise.all([
    categorySummaries(),
    categorySummaries("men"),
    categorySummaries("women"),
    db()
      .selectDistinct({ gender: s.products.gender })
      .from(s.products)
      .where(and(isVisible, inArray(s.products.gender, ["men", "women"]))),
    collectionSummaries(),
  ]);
  const present = new Set(genders.map((row) => row.gender));
  return {
    categories,
    genders: (["men", "women"] as const).filter((gender) => present.has(gender)),
    byGender: { men, women },
    hasCollections: collections.length > 0,
  };
}

export async function homeData(): Promise<HomeData> {
  const visibleIds = (order: ReturnType<typeof orderFor>, extra?: SQL, limit = 8) =>
    db()
      .select({ id: s.products.id })
      .from(s.products)
      .where(extra ? and(isVisible, extra) : isVisible)
      .orderBy(...order)
      .limit(limit)
      .then((rows) => rows.map((row) => row.id));

  const [newIds, featuredIds, bestIds, categories, collections] = await Promise.all([
    visibleIds(orderFor("newest")),
    visibleIds(orderFor("featured"), eq(s.products.isFeatured, true)),
    // Only products with real confirmed sales — an empty list hides the section.
    visibleIds(orderFor("best-selling"), sql`${unitsSoldExpr} > 0`),
    categorySummaries(),
    collectionSummaries(),
  ]);

  const [newArrivals, featured, bestSellers] = await Promise.all([
    summarize(newIds),
    summarize(featuredIds),
    summarize(bestIds),
  ]);
  return { newArrivals, featured, bestSellers, categories, collections };
}

/** Everything a sitemap should list. */
export async function sitemapEntries() {
  const [productRows, categories, collections] = await Promise.all([
    db()
      .select({ slug: s.products.slug, updatedAt: s.products.updatedAt })
      .from(s.products)
      .where(isVisible),
    categorySummaries(),
    collectionSummaries(),
  ]);
  return { products: productRows, categories, collections };
}
