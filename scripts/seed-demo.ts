/**
 * DEMO catalog so every storefront flow can be exercised before real products exist.
 * Everything here is fake and flagged: products carry `is_demo = true`, names say "Demo",
 * and images point at `placeholder:` keys rendered as labelled tone blocks.
 * Remove before launch with `npm run db:seed -- --clean`.
 */
import { inArray, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as s from "../src/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PgDatabase<PgQueryResultHKT, any>;

export const DEMO_CATEGORY_SLUGS = ["t-shirts", "hoodies", "pants", "accessories"] as const;
export const DEMO_COLLECTION_SLUGS = ["demo-collection-01", "demo-collection-02"] as const;

const CATEGORIES = [
  { slug: "t-shirts", name: "T-Shirts", position: 0 },
  { slug: "hoodies", name: "Hoodies", position: 1 },
  { slug: "pants", name: "Pants", position: 2 },
  { slug: "accessories", name: "Accessories", position: 3 },
];

const COLORS = [
  { name: "Demo Black", hex: "#1a1a19" },
  { name: "Demo Bone", hex: "#e6e0d4" },
  { name: "Demo Olive", hex: "#5b5a3f" },
  { name: "Demo Clay", hex: "#9a6b52" },
];

const APPAREL_SIZES = ["S", "M", "L", "XL"];

type DemoProduct = {
  n: number;
  category: (typeof DEMO_CATEGORY_SLUGS)[number];
  gender: "men" | "women" | "unisex";
  price: number; // EGP minor units (piastres) — demo values only
  compareAt?: number;
  colors: number[];
  featured?: boolean;
  soldOut?: boolean;
  collection?: 0 | 1;
  daysAgo: number;
};

const PRODUCTS: DemoProduct[] = [
  { n: 1, category: "t-shirts", gender: "unisex", price: 100000, colors: [0, 1], featured: true, collection: 0, daysAgo: 2 },
  { n: 2, category: "t-shirts", gender: "women", price: 90000, colors: [1, 3], featured: true, collection: 0, daysAgo: 5 },
  { n: 3, category: "t-shirts", gender: "men", price: 110000, compareAt: 140000, colors: [0, 2], collection: 1, daysAgo: 40 },
  { n: 4, category: "hoodies", gender: "unisex", price: 240000, colors: [0, 1, 2], featured: true, collection: 0, daysAgo: 1 },
  { n: 5, category: "hoodies", gender: "women", price: 220000, colors: [3], soldOut: true, collection: 1, daysAgo: 60 },
  { n: 6, category: "hoodies", gender: "men", price: 260000, compareAt: 320000, colors: [2, 0], featured: true, daysAgo: 25 },
  { n: 7, category: "pants", gender: "men", price: 200000, colors: [0, 2], collection: 1, daysAgo: 9 },
  { n: 8, category: "pants", gender: "women", price: 190000, colors: [1, 0], featured: true, collection: 0, daysAgo: 3 },
  { n: 9, category: "pants", gender: "unisex", price: 210000, colors: [3, 1], daysAgo: 75 },
  { n: 10, category: "accessories", gender: "unisex", price: 50000, colors: [0], featured: true, daysAgo: 6 },
  { n: 11, category: "accessories", gender: "unisex", price: 70000, compareAt: 90000, colors: [1, 3], collection: 1, daysAgo: 33 },
  { n: 12, category: "t-shirts", gender: "unisex", price: 95000, colors: [2, 1, 0], collection: 0, daysAgo: 12 },
];

const pad = (n: number) => String(n).padStart(2, "0");

export async function cleanDemo(db: Db) {
  await db.delete(s.products).where(eq(s.products.isDemo, true));
  await db.delete(s.collections).where(inArray(s.collections.slug, [...DEMO_COLLECTION_SLUGS]));
  await db.delete(s.categories).where(inArray(s.categories.slug, [...DEMO_CATEGORY_SLUGS]));
  await db.delete(s.sizeCharts).where(eq(s.sizeCharts.name, "Demo size chart"));
}

export async function seedDemo(db: Db) {
  await db.transaction(async (tx) => {
    await cleanDemo(tx);

    const [chart] = await tx
      .insert(s.sizeCharts)
      .values({
        name: "Demo size chart",
        unit: "cm",
        columns: ["Chest", "Length"],
        rows: APPAREL_SIZES.map((size) => ({ size, values: ["[ADD]", "[ADD]"] })),
        notes: "[ADD MEASURING GUIDANCE] — placeholder chart, replace with real measurements.",
      })
      .returning();

    const categories = await tx.insert(s.categories).values(CATEGORIES).returning();
    const categoryId = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

    const collections = await tx
      .insert(s.collections)
      .values([
        { slug: DEMO_COLLECTION_SLUGS[0], name: "Demo Collection 01", description: "[ADD COLLECTION STORY]", position: 0 },
        { slug: DEMO_COLLECTION_SLUGS[1], name: "Demo Collection 02", description: "[ADD COLLECTION STORY]", position: 1 },
      ])
      .returning();

    const now = Date.now();
    for (const p of PRODUCTS) {
      const label = `Demo Product ${pad(p.n)}`;
      const [product] = await tx
        .insert(s.products)
        .values({
          slug: `demo-product-${pad(p.n)}`,
          name: label,
          description: "[ADD PRODUCT DESCRIPTION]",
          material: "[ADD MATERIAL]",
          fit: "[ADD FIT]",
          care: "[ADD CARE INSTRUCTIONS]",
          categoryId: categoryId[p.category]!,
          gender: p.gender,
          status: "active",
          isFeatured: p.featured ?? false,
          merchRank: p.featured ? 100 - p.n : 0,
          publishedAt: new Date(now - p.daysAgo * 86_400_000),
          sizeChartId: p.category === "accessories" ? null : chart!.id,
          tags: ["demo", p.category],
          isDemo: true,
        })
        .returning();

      const colors = await tx
        .insert(s.productColors)
        .values(p.colors.map((c, i) => ({ productId: product!.id, ...COLORS[c]!, position: i })))
        .returning();

      await tx.insert(s.productImages).values(
        colors.flatMap((color, ci) =>
          (["primary", "hover", "gallery", "gallery"] as const).map((role, i) => ({
            productId: product!.id,
            colorId: color.id,
            key: `placeholder:${(p.n + ci + i) % 4}`,
            alt: `${label} in ${color.name} — placeholder image ${i + 1}`,
            width: 1600,
            height: 2000,
            role,
            position: i,
          })),
        ),
      );

      const sizes = p.category === "accessories" ? [null] : APPAREL_SIZES;
      await tx.insert(s.variants).values(
        colors.flatMap((color, ci) =>
          sizes.map((size, si) => ({
            productId: product!.id,
            colorId: color.id,
            size,
            sku: `DEMO-${pad(p.n)}-${ci + 1}${size ? `-${size}` : ""}`,
            price: p.price,
            compareAtPrice: p.compareAt ?? null,
            // Deterministic stock; some sizes low or out to exercise UI states.
            stock: p.soldOut ? 0 : (p.n * 7 + ci * 3 + si * 5) % 13,
          })),
        ),
      );

      if (p.collection !== undefined) {
        await tx
          .insert(s.productCollections)
          .values({ productId: product!.id, collectionId: collections[p.collection]!.id, position: p.n });
      }
    }
  });
}
