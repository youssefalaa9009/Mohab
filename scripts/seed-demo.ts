/**
 * EXAMPLE catalog, so the shop can be reviewed as it will look and every flow
 * exercised before QUATTRO's real products exist. Names, prices, copy and
 * photos are examples: products carry `is_demo = true`, SKUs start with DEMO-,
 * and photos are free-licence stand-ins (scripts/example-media).
 * Remove before launch with `npm run db:seed -- --clean`.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as s from "../server/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = PgDatabase<PgQueryResultHKT, any>;

export const DEMO_CATEGORY_SLUGS = ["t-shirts", "hoodies", "pants", "accessories"] as const;
export const DEMO_COLLECTION_SLUGS = ["essentials", "summer-edit"] as const;

const CATEGORIES = [
  { slug: "t-shirts", name: "T-Shirts", position: 0 },
  { slug: "hoodies", name: "Hoodies", position: 1 },
  { slug: "pants", name: "Pants", position: 2 },
  { slug: "accessories", name: "Accessories", position: 3 },
];

const COLLECTIONS = [
  {
    slug: DEMO_COLLECTION_SLUGS[0],
    name: "Essentials",
    description:
      "The pieces everything else is built around: heavyweight tees, a hoodie you'll live in and trousers that go anywhere.",
    heroImageKey: "examples/collection-essentials",
    position: 0,
  },
  {
    slug: DEMO_COLLECTION_SLUGS[1],
    name: "Summer Edit",
    description:
      "Lighter cloth and easier cuts for long, hot days — white tees, wide trousers and a beanie for the cool evenings by the sea.",
    heroImageKey: "examples/collection-summer-edit",
    position: 1,
  },
];

/** Swatch colours, keyed by name. */
const HEX: Record<string, string> = {
  Black: "#1a1a19",
  White: "#f2f0eb",
  Taupe: "#8b7d70",
  Sand: "#c9b79c",
  Cream: "#e8dfcc",
  Charcoal: "#3a3a3c",
  Stone: "#b5ab9c",
  Grey: "#a7a9ab",
  Natural: "#d9cdb4",
  Oat: "#cdbfa6",
};

const APPAREL_SIZES = ["S", "M", "L", "XL"];

type DemoProduct = {
  n: number;
  slug: string;
  name: string;
  category: (typeof DEMO_CATEGORY_SLUGS)[number];
  gender: "men" | "women" | "unisex";
  price: number; // EGP minor units (piastres) — example values only
  compareAt?: number;
  featured?: boolean;
  soldOut?: boolean;
  collection?: 0 | 1;
  daysAgo: number;
  /** Colour name → example photo names (first is the card image, second the hover). */
  colors: [string, string[]][];
  description: string;
  material: string;
  fit: string;
  care: string;
};

const CARE_COTTON =
  "Machine wash cold, inside out. Dry flat. Cool iron on the reverse. Do not tumble dry.";
const CARE_FLEECE =
  "Machine wash cold with similar colours, inside out. Dry flat; do not tumble dry or iron the print-free face.";

const PRODUCTS: DemoProduct[] = [
  {
    n: 1,
    slug: "essential-heavyweight-tee",
    name: "Essential Heavyweight Tee",
    category: "t-shirts",
    gender: "unisex",
    price: 100000,
    featured: true,
    collection: 0,
    daysAgo: 2,
    colors: [
      ["Black", ["essential-tee-black-1"]],
      ["White", ["essential-tee-white-1", "essential-tee-white-2"]],
    ],
    description:
      "The tee the rest of the wardrobe is built on. Dense 240 gsm cotton jersey that keeps its shape wash after wash, with a ribbed crew neck that lies flat and stays that way.",
    material: "100% combed cotton jersey, 240 gsm.",
    fit: "Relaxed through the body with a slightly dropped shoulder. True to size; size down for a closer fit.",
    care: CARE_COTTON,
  },
  {
    n: 2,
    slug: "relaxed-tee",
    name: "Relaxed Tee",
    category: "t-shirts",
    gender: "women",
    price: 90000,
    featured: true,
    collection: 1,
    daysAgo: 5,
    colors: [
      ["White", ["relaxed-tee-white-1", "relaxed-tee-white-2"]],
      ["Black", ["relaxed-tee-black-1", "relaxed-tee-black-2"]],
    ],
    description:
      "An easy, fluid tee with a soft hand and a gentle drape. Tucked into tailoring or worn loose over denim, it does the quiet work.",
    material: "100% cotton jersey, 200 gsm, garment washed for softness.",
    fit: "Relaxed, hip-length cut. True to size.",
    care: CARE_COTTON,
  },
  {
    n: 3,
    slug: "boxy-tee",
    name: "Boxy Tee",
    category: "t-shirts",
    gender: "men",
    price: 110000,
    compareAt: 140000,
    collection: 1,
    daysAgo: 40,
    colors: [
      ["White", ["boxy-tee-white-1", "boxy-tee-white-2"]],
      ["Black", ["boxy-tee-black-1", "boxy-tee-black-2"]],
    ],
    description:
      "A wide, cropped body and a sturdy neckline give this tee its architectural shape. Heavy enough to wear on its own, all summer long.",
    material: "100% cotton jersey, 260 gsm.",
    fit: "Boxy and slightly cropped. Take your usual size for the intended shape.",
    care: CARE_COTTON,
  },
  {
    n: 4,
    slug: "loopback-hoodie",
    name: "Loopback Hoodie",
    category: "hoodies",
    gender: "unisex",
    price: 240000,
    featured: true,
    collection: 0,
    daysAgo: 1,
    colors: [
      ["Black", ["loopback-hoodie-black-1", "loopback-hoodie-black-2"]],
      ["Taupe", ["loopback-hoodie-taupe-1", "loopback-hoodie-taupe-2"]],
    ],
    description:
      "Our everyday hoodie in a dense loopback cotton that gets softer every time you wear it. A lined hood, flat drawcords and a deep kangaroo pocket.",
    material: "100% cotton loopback fleece, 400 gsm.",
    fit: "Relaxed with a dropped shoulder. True to size; size up for an oversized look.",
    care: CARE_FLEECE,
  },
  {
    n: 5,
    slug: "oversized-hoodie",
    name: "Oversized Hoodie",
    category: "hoodies",
    gender: "women",
    price: 220000,
    soldOut: true,
    collection: 1,
    daysAgo: 60,
    colors: [["Sand", ["oversized-hoodie-sand-1", "oversized-hoodie-sand-2"]]],
    description:
      "A generously cut hoodie in brushed-back fleece, with long sleeves and a soft, structured hood. Made for slow mornings and cool evenings.",
    material: "80% cotton, 20% polyester brushed fleece, 380 gsm.",
    fit: "Oversized. Take your usual size for the intended volume, or size down for a relaxed fit.",
    care: CARE_FLEECE,
  },
  {
    n: 6,
    slug: "zip-hoodie",
    name: "Zip Hoodie",
    category: "hoodies",
    gender: "men",
    price: 260000,
    compareAt: 320000,
    featured: true,
    daysAgo: 25,
    colors: [
      ["Cream", ["zip-hoodie-cream-1", "zip-hoodie-cream-2"]],
      ["Charcoal", ["zip-hoodie-charcoal-1"]],
    ],
    description:
      "A full-zip hoodie with a two-way metal zip, split pockets and ribbed cuffs. The layer you reach for between seasons.",
    material: "100% cotton loopback fleece, 380 gsm. Metal zip.",
    fit: "Regular fit, hip length. True to size.",
    care: CARE_FLEECE,
  },
  {
    n: 7,
    slug: "pleated-trouser",
    name: "Pleated Trouser",
    category: "pants",
    gender: "men",
    price: 200000,
    collection: 1,
    daysAgo: 9,
    colors: [
      ["Black", ["pleated-trouser-black-1", "pleated-trouser-black-2"]],
      ["Stone", ["pleated-trouser-stone-1"]],
    ],
    description:
      "A single-pleat trouser with a high rise and a straight, generous leg. Smart enough for dinner, easy enough for every day.",
    material: "68% polyester, 30% viscose, 2% elastane suiting.",
    fit: "High rise, relaxed straight leg. Full length; designed to break softly over the shoe.",
    care: "Machine wash cold on a delicate cycle, or dry clean. Hang to dry. Warm iron.",
  },
  {
    n: 8,
    slug: "wide-leg-trouser",
    name: "Wide-Leg Trouser",
    category: "pants",
    gender: "women",
    price: 190000,
    featured: true,
    collection: 0,
    daysAgo: 3,
    colors: [
      ["Sand", ["wide-leg-trouser-sand-1", "wide-leg-trouser-sand-2"]],
      ["Black", ["wide-leg-trouser-black-1", "wide-leg-trouser-black-2"]],
    ],
    description:
      "Fluid, floor-grazing trousers in a breathable linen blend, with an elasticated back waist and deep side pockets.",
    material: "55% linen, 45% viscose.",
    fit: "High rise, wide leg. Elasticated back waist. True to size.",
    care: "Hand wash or machine wash cold on a delicate cycle. Line dry. Warm iron while damp.",
  },
  {
    n: 9,
    slug: "fleece-sweatpant",
    name: "Fleece Sweatpant",
    category: "pants",
    gender: "unisex",
    price: 210000,
    daysAgo: 75,
    colors: [
      ["Grey", ["fleece-sweatpant-grey-1", "fleece-sweatpant-grey-2"]],
      ["Taupe", ["fleece-sweatpant-taupe-1", "fleece-sweatpant-taupe-2"]],
    ],
    description:
      "The matching half to our hoodies: soft loopback fleece, a drawcord waist and cuffed ankles that sit just right over a sneaker.",
    material: "100% cotton loopback fleece, 380 gsm.",
    fit: "Relaxed through the thigh, tapered to a cuffed ankle. True to size.",
    care: CARE_FLEECE,
  },
  {
    n: 10,
    slug: "canvas-tote",
    name: "Canvas Tote",
    category: "accessories",
    gender: "unisex",
    price: 50000,
    featured: true,
    daysAgo: 6,
    colors: [
      ["Black", ["canvas-tote-black-1", "canvas-tote-black-2"]],
      ["Natural", ["canvas-tote-natural-1", "canvas-tote-natural-2"]],
    ],
    description:
      "A heavy cotton canvas tote with long handles that sit comfortably on the shoulder, and room for a laptop, a market run or a beach towel.",
    material: "100% cotton canvas, 12 oz.",
    fit: "40 × 42 cm, with 65 cm handles.",
    care: "Spot clean, or hand wash cold and dry flat.",
  },
  {
    n: 11,
    slug: "ribbed-beanie",
    name: "Ribbed Beanie",
    category: "accessories",
    gender: "unisex",
    price: 70000,
    compareAt: 90000,
    collection: 1,
    daysAgo: 33,
    colors: [
      ["Black", ["ribbed-beanie-black-1", "ribbed-beanie-black-2"]],
      ["Oat", ["ribbed-beanie-oat-1", "ribbed-beanie-oat-2"]],
    ],
    description:
      "A chunky rib-knit beanie with a deep turn-up. Warm enough for winter in the desert, soft enough to forget you're wearing it.",
    material: "50% wool, 50% acrylic.",
    fit: "One size, with plenty of stretch.",
    care: "Hand wash cold and dry flat.",
  },
  {
    n: 12,
    slug: "organic-cotton-tee",
    name: "Organic Cotton Tee",
    category: "t-shirts",
    gender: "unisex",
    price: 95000,
    collection: 0,
    daysAgo: 12,
    colors: [
      ["White", ["organic-tee-white-1", "organic-tee-white-2"]],
      ["Black", ["organic-tee-black-1"]],
    ],
    description:
      "A lighter, everyday tee in certified organic cotton, with a clean crew neck and a fit that works under everything.",
    material: "100% organic cotton jersey, 180 gsm.",
    fit: "Regular fit. True to size.",
    care: CARE_COTTON,
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Example delivery rates. Rates are business data: these show how delivery
 * looks at checkout and are removed with the rest of the demo data.
 */
const EXAMPLE_RATES = [
  {
    name: "Standard delivery",
    region: null,
    price: 8500,
    freeOver: 200000,
    etaMinDays: 2,
    etaMaxDays: 5,
    position: 0,
  },
  {
    name: "Express delivery",
    region: "Cairo",
    price: 15000,
    freeOver: null,
    etaMinDays: 1,
    etaMaxDays: 1,
    position: 1,
  },
  {
    name: "Express delivery",
    region: "Giza",
    price: 15000,
    freeOver: null,
    etaMinDays: 1,
    etaMaxDays: 1,
    position: 1,
  },
];
const EXAMPLE_RATE_NAMES = [...new Set(EXAMPLE_RATES.map((rate) => rate.name))];
/** The earlier demo rate, removed by --clean on databases seeded before the example rates. */
const LEGACY_DEMO_RATE = "[DEMO] Delivery — set real rates before launch";
const SIZE_CHART_NAME = "Example size chart — tops";

/**
 * Remove demo data. Demo categories and collections are only deleted while no
 * real product uses them: once QUATTRO files real products under "T-Shirts",
 * that category is theirs and stays.
 */
export async function cleanDemo(db: Db) {
  await db
    .delete(s.shippingRates)
    .where(inArray(s.shippingRates.name, [...EXAMPLE_RATE_NAMES, LEGACY_DEMO_RATE]));
  await db.delete(s.products).where(eq(s.products.isDemo, true));
  await db
    .delete(s.collections)
    .where(
      and(
        inArray(s.collections.slug, [
          ...DEMO_COLLECTION_SLUGS,
          "demo-collection-01",
          "demo-collection-02",
        ]),
        sql`not exists (select 1 from ${s.productCollections} where ${s.productCollections.collectionId} = ${s.collections.id})`,
      ),
    );
  await db
    .delete(s.categories)
    .where(
      and(
        inArray(s.categories.slug, [...DEMO_CATEGORY_SLUGS]),
        sql`not exists (select 1 from ${s.products} where ${s.products.categoryId} = ${s.categories.id})`,
      ),
    );
  await db
    .delete(s.sizeCharts)
    .where(inArray(s.sizeCharts.name, [SIZE_CHART_NAME, "Demo size chart"]));
}

export async function seedDemo(db: Db) {
  await db.transaction(async (tx) => {
    await cleanDemo(tx);

    await tx.insert(s.shippingRates).values(EXAMPLE_RATES);

    const [chart] = await tx
      .insert(s.sizeCharts)
      .values({
        name: SIZE_CHART_NAME,
        unit: "cm",
        columns: ["Chest", "Length", "Sleeve"],
        rows: [
          { size: "S", values: ["104", "68", "21"] },
          { size: "M", values: ["110", "70", "22"] },
          { size: "L", values: ["116", "72", "23"] },
          { size: "XL", values: ["122", "74", "24"] },
        ],
        notes:
          "Garment measurements, laid flat: chest is measured 2 cm below the armhole, length from the highest point of the shoulder to the hem.",
      })
      .returning();

    // Kept categories (in use by real products) are reused, not duplicated.
    await tx
      .insert(s.categories)
      .values(CATEGORIES)
      .onConflictDoNothing({ target: s.categories.slug });
    for (const slug of DEMO_CATEGORY_SLUGS) {
      // Example cover photo, only where QUATTRO hasn't set one.
      await tx
        .update(s.categories)
        .set({ imageKey: `examples/category-${slug}` })
        .where(and(eq(s.categories.slug, slug), isNull(s.categories.imageKey)));
    }
    const categories = await tx
      .select({ id: s.categories.id, slug: s.categories.slug })
      .from(s.categories)
      .where(inArray(s.categories.slug, [...DEMO_CATEGORY_SLUGS]));
    const categoryId = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

    await tx
      .insert(s.collections)
      .values(COLLECTIONS)
      .onConflictDoNothing({ target: s.collections.slug });
    const collectionRows = await tx
      .select({ id: s.collections.id, slug: s.collections.slug })
      .from(s.collections)
      .where(inArray(s.collections.slug, [...DEMO_COLLECTION_SLUGS]));
    const collections = DEMO_COLLECTION_SLUGS.map((slug) =>
      collectionRows.find((row) => row.slug === slug)!,
    );

    const now = Date.now();
    for (const p of PRODUCTS) {
      const [product] = await tx
        .insert(s.products)
        .values({
          slug: p.slug,
          name: p.name,
          description: p.description,
          material: p.material,
          fit: p.fit,
          care: p.care,
          categoryId: categoryId[p.category]!,
          gender: p.gender,
          status: "active",
          isFeatured: p.featured ?? false,
          merchRank: p.featured ? 100 - p.n : 0,
          publishedAt: new Date(now - p.daysAgo * 86_400_000),
          sizeChartId: p.category === "accessories" ? null : chart!.id,
          tags: [p.category, ...p.colors.map(([name]) => name.toLowerCase())],
          isDemo: true,
        })
        .returning();

      const colors = await tx
        .insert(s.productColors)
        .values(
          p.colors.map(([name], i) => ({
            productId: product!.id,
            name,
            hex: HEX[name] ?? null,
            position: i,
          })),
        )
        .returning();

      await tx.insert(s.productImages).values(
        colors.flatMap((color, ci) =>
          p.colors[ci]![1].map((photo, i) => ({
            productId: product!.id,
            colorId: color.id,
            key: `examples/${photo}`,
            alt: `${p.name} in ${color.name}${i ? `, view ${i + 1}` : ""}`,
            width: 1600,
            height: 2000,
            role:
              i === 0 ? ("primary" as const) : i === 1 ? ("hover" as const) : ("gallery" as const),
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
        await tx.insert(s.productCollections).values({
          productId: product!.id,
          collectionId: collections[p.collection]!.id,
          position: p.n,
        });
      }
    }
  });
}
