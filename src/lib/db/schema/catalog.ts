import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  currency,
  gender,
  imageRole,
  productStatus,
  sizeUnit,
  timestamps,
} from "./shared";

/*
 * Base rows hold default-locale (English) content. Other locales live in *_translations tables,
 * so adding Arabic is data entry — not a migration of every table.
 * Image columns store storage keys (R2 object keys), never absolute URLs.
 */

export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    parentId: uuid().references((): AnyPgColumn => categories.id, { onDelete: "set null" }),
    slug: text().notNull().unique(),
    name: text().notNull(),
    description: text(),
    imageKey: text(),
    position: integer().default(0).notNull(),
    isActive: boolean().default(true).notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.parentId)],
);

export const collections = pgTable("collections", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  heroImageKey: text(),
  startsAt: timestamp({ withTimezone: true }),
  endsAt: timestamp({ withTimezone: true }),
  position: integer().default(0).notNull(),
  isActive: boolean().default(true).notNull(),
  ...timestamps,
});

export type SizeChartRow = { size: string; values: string[] };

export const sizeCharts = pgTable("size_charts", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  unit: sizeUnit().default("cm").notNull(),
  /** Measurement column headings, e.g. ["Chest", "Length", "Sleeve"] */
  columns: jsonb().$type<string[]>().notNull(),
  rows: jsonb().$type<SizeChartRow[]>().notNull(),
  notes: text(),
  ...timestamps,
});

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    description: text(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    gender: gender().default("unisex").notNull(),
    material: text(),
    fit: text(),
    care: text(),
    tags: text().array().default(sql`'{}'::text[]`).notNull(),
    status: productStatus().default("draft").notNull(),
    isFeatured: boolean().default(false).notNull(),
    /** Manual merchandising order for the "Featured" sort. Best-seller rank is derived from orders. */
    merchRank: integer().default(0).notNull(),
    publishedAt: timestamp({ withTimezone: true }),
    sizeChartId: uuid().references(() => sizeCharts.id, { onDelete: "set null" }),
    seoTitle: text(),
    seoDescription: text(),
    /** Seeded demo content — must be deleted before launch. */
    isDemo: boolean().default(false).notNull(),
    ...timestamps,
  },
  (t) => [
    index().on(t.categoryId),
    index().on(t.status, t.publishedAt),
    index().using("gin", t.tags),
  ],
);

export const productCollections = pgTable(
  "product_collections",
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    collectionId: uuid()
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    position: integer().default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.collectionId] }), index().on(t.collectionId)],
);

export const productColors = pgTable(
  "product_colors",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text().notNull(),
    hex: char({ length: 7 }),
    swatchImageKey: text(),
    position: integer().default(0).notNull(),
  },
  (t) => [unique().on(t.productId, t.name)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Null = applies to every colour. */
    colorId: uuid().references(() => productColors.id, { onDelete: "set null" }),
    key: text().notNull(),
    alt: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    role: imageRole().default("gallery").notNull(),
    position: integer().default(0).notNull(),
  },
  (t) => [index().on(t.productId, t.position)],
);

export const variants = pgTable(
  "variants",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorId: uuid().references(() => productColors.id, { onDelete: "restrict" }),
    /** Null for one-size products. */
    size: text(),
    sku: text().notNull().unique(),
    price: integer().notNull(),
    compareAtPrice: integer(),
    currency: currency(),
    stock: integer().default(0).notNull(),
    isActive: boolean().default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    index().on(t.productId),
    unique().on(t.productId, t.colorId, t.size).nullsNotDistinct(),
    check("variants_price_nonnegative", sql`${t.price} >= 0`),
    check("variants_stock_nonnegative", sql`${t.stock} >= 0`),
    check(
      "variants_compare_at_above_price",
      sql`${t.compareAtPrice} IS NULL OR ${t.compareAtPrice} > ${t.price}`,
    ),
  ],
);

/* ─── Translations ───────────────────────────────────────────────────────── */

export const productTranslations = pgTable(
  "product_translations",
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    locale: text().notNull(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    material: text(),
    fit: text(),
    care: text(),
    seoTitle: text(),
    seoDescription: text(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.locale] }), unique().on(t.locale, t.slug)],
);

export const categoryTranslations = pgTable(
  "category_translations",
  {
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    locale: text().notNull(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.locale] }), unique().on(t.locale, t.slug)],
);

export const collectionTranslations = pgTable(
  "collection_translations",
  {
    collectionId: uuid()
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    locale: text().notNull(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.locale] }), unique().on(t.locale, t.slug)],
);
