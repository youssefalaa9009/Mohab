import { and, asc, eq, ilike, isNotNull, lte, sql, type SQL } from "drizzle-orm";
import type { CategorySummary, ProductSummary } from "../../src/features/catalog/types.js";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";
import { summarizeProducts } from "./repository.js";

const MAX_TOKENS = 5;
/** Above this, word_similarity counts a misspelt word as a match ("hodie" → "hoodie"). */
const FUZZY_THRESHOLD = 0.4;

export type SearchResult = {
  query: string;
  products: ProductSummary[];
  categories: CategorySummary[];
  total: number;
};

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

/** Lower-case words, wildcard-escaped, at most a handful. */
export function tokenize(query: string) {
  return [
    ...new Set(
      query
        .toLowerCase()
        .normalize("NFKC")
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  ].slice(0, MAX_TOKENS);
}

/*
 * Correlated references spell out "products"."id" by hand: Drizzle drops table
 * qualifiers in single-table queries (see catalog/repository.ts).
 */
/**
 * Typo tolerance is for words, not codes: a SKU or a number fuzzily matches
 * far too much. Letters only (Latin or Arabic), four or more of them.
 */
const isWord = (token: string) => /^[\p{L}]{4,}$/u.test(token);

function tokenMatch(token: string): { match: SQL; score: SQL } {
  const like = `%${escapeLike(token)}%`;
  const fuzzy = isWord(token);
  const similar = (column: SQL) =>
    fuzzy ? sql`word_similarity(${token}, ${column}) > ${FUZZY_THRESHOLD}` : sql`false`;

  const inCategory = sql`exists (select 1 from categories where categories.id = "products"."category_id" and (categories.name ilike ${like} or ${similar(sql`categories.name`)}))`;
  const inColor = sql`exists (select 1 from product_colors where product_colors.product_id = "products"."id" and (product_colors.name ilike ${like} or ${similar(sql`product_colors.name`)}))`;
  const inTags = sql`exists (select 1 from unnest("products"."tags") as tag where tag ilike ${like})`;
  const inCollection = sql`exists (select 1 from product_collections join collections on collections.id = product_collections.collection_id where product_collections.product_id = "products"."id" and collections.is_active and collections.name ilike ${like})`;
  const inSku = sql`exists (select 1 from variants where variants.product_id = "products"."id" and variants.sku ilike ${like})`;
  const nameLike = sql`"products"."name" ilike ${like}`;
  const nameFuzzy = similar(sql`"products"."name"`);
  const description = sql`coalesce("products"."description", '') ilike ${like}`;

  return {
    match: sql`(${nameLike} or ${nameFuzzy} or ${inCategory} or ${inColor} or ${inTags} or ${inCollection} or ${inSku} or ${description})`,
    // Where a word matched decides how strongly it counts.
    score: sql`(
      case when "products"."name" ilike ${`${escapeLike(token)}%`} then 4
           when ${nameLike} then 3 else 0 end
      + ${fuzzy ? sql`word_similarity(${token}, "products"."name") * 2` : sql`0`}
      + case when ${inCategory} then 1.5 else 0 end
      + case when ${inColor} then 1 else 0 end
      + case when ${inCollection} then 1 else 0 end
      + case when ${inTags} then 0.75 else 0 end
      + case when ${inSku} then 2 else 0 end
      + case when ${description} then 0.4 else 0 end
    )`,
  };
}

const isVisible = and(
  eq(s.products.status, "active"),
  isNotNull(s.products.publishedAt),
  lte(s.products.publishedAt, sql`now()`),
)!;

export async function searchCatalog(query: string, limit: number): Promise<SearchResult> {
  const tokens = tokenize(query);
  if (!tokens.length) return { query, products: [], categories: [], total: 0 };

  const parts = tokens.map(tokenMatch);
  const where = and(isVisible, ...parts.map((part) => part.match));
  const score = sql.join(
    parts.map((part) => part.score),
    sql` + `,
  );

  const [rows, totals, categories] = await Promise.all([
    db()
      .select({ id: s.products.id })
      .from(s.products)
      .where(where)
      .orderBy(sql`${score} desc`, sql`"products"."merch_rank" desc`)
      .limit(limit),
    db()
      .select({ total: sql<number>`count(*)::int` })
      .from(s.products)
      .where(where),
    // Categories whose name matches the whole query, for "go to Hoodies" shortcuts.
    db()
      .select({
        slug: s.categories.slug,
        name: s.categories.name,
        productCount: sql<number>`(select count(*)::int from products where products.category_id = "categories"."id" and products.status = 'active')`,
        imageKey: s.categories.imageKey,
      })
      .from(s.categories)
      .where(
        and(
          eq(s.categories.isActive, true),
          sql`(${ilike(s.categories.name, `%${escapeLike(tokens.join(" "))}%`)} or ${
            // Same typo tolerance as products: "hodie" still offers Hoodies.
            tokens.every(isWord)
              ? sql`word_similarity(${tokens.join(" ")}, ${s.categories.name}) > ${FUZZY_THRESHOLD}`
              : sql`false`
          })`,
        ),
      )
      .orderBy(asc(s.categories.position))
      .limit(3),
  ]);

  return {
    query,
    products: await summarizeProducts(rows.map((row) => row.id)),
    categories: categories.filter((category) => category.productCount > 0),
    total: totals[0]?.total ?? 0,
  };
}
