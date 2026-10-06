import { asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type {
  AdminCoupon,
  AdminCustomer,
  AdminShippingRate,
  AdminTaxonomyItem,
} from "../../src/features/admin/types.js";
import { slugify } from "../catalog/repository.js";
import { normalizeCode } from "../commerce/coupons.js";
import { db } from "../db/client.js";
import { isUniqueViolation } from "../db/errors.js";
import * as s from "../db/schema/index.js";

export class SettingsError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

const iso = (date: Date | null) => date?.toISOString() ?? null;

/* ─── Discount codes ──────────────────────────────────────────────────────── */

export type CouponInput = Omit<AdminCoupon, "id" | "timesUsed" | "startsAt" | "endsAt"> & {
  startsAt: Date | null;
  endsAt: Date | null;
};

export async function listCoupons(): Promise<AdminCoupon[]> {
  const rows = await db().select().from(s.coupons).orderBy(desc(s.coupons.createdAt));
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    minSubtotal: row.minSubtotal,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    usageLimit: row.usageLimit,
    perCustomerLimit: row.perCustomerLimit,
    timesUsed: row.timesUsed,
    isActive: row.isActive,
  }));
}

function checkCoupon(input: CouponInput) {
  if (input.type === "percent" && (input.value < 1 || input.value > 100)) {
    throw new SettingsError("A percentage discount must be between 1 and 100.");
  }
  if (input.type === "fixed" && input.value <= 0) {
    throw new SettingsError("Enter the amount to take off.");
  }
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
    throw new SettingsError("The end date must be after the start date.");
  }
}

export async function saveCoupon(id: string | null, input: CouponInput) {
  checkCoupon(input);
  const values = {
    ...input,
    code: normalizeCode(input.code),
    value: input.type === "free_shipping" ? 0 : input.value,
  };
  try {
    if (id) await db().update(s.coupons).set(values).where(eq(s.coupons.id, id));
    else await db().insert(s.coupons).values(values);
  } catch (error) {
    if (isUniqueViolation(error))
      throw new SettingsError(`The code ${values.code} already exists.`);
    throw error;
  }
}

/* ─── Delivery rates ──────────────────────────────────────────────────────── */

export type ShippingRateInput = Omit<AdminShippingRate, "id">;

export async function listShippingRates(): Promise<AdminShippingRate[]> {
  const rows = await db()
    .select()
    .from(s.shippingRates)
    .orderBy(asc(s.shippingRates.position), asc(s.shippingRates.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    region: row.region,
    price: row.price,
    freeOver: row.freeOver,
    etaMinDays: row.etaMinDays,
    etaMaxDays: row.etaMaxDays,
    isActive: row.isActive,
    position: row.position,
  }));
}

export async function saveShippingRate(id: string | null, input: ShippingRateInput) {
  if (
    input.etaMinDays !== null &&
    input.etaMaxDays !== null &&
    input.etaMaxDays < input.etaMinDays
  ) {
    throw new SettingsError("The longest delivery time can’t be shorter than the shortest.");
  }
  if (id) await db().update(s.shippingRates).set(input).where(eq(s.shippingRates.id, id));
  else await db().insert(s.shippingRates).values(input);
}

/* ─── Categories & collections ────────────────────────────────────────────── */

export type TaxonomyInput = {
  name: string;
  slug?: string | undefined;
  description: string | null;
  isActive: boolean;
  position: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export async function listCategories(): Promise<AdminTaxonomyItem[]> {
  return db()
    .select({
      id: s.categories.id,
      slug: s.categories.slug,
      name: s.categories.name,
      description: s.categories.description,
      isActive: s.categories.isActive,
      position: s.categories.position,
      // Outer table spelled out: Drizzle drops qualifiers in single-table queries.
      productCount: sql<number>`(select count(*)::int from products where products.category_id = "categories"."id")`,
    })
    .from(s.categories)
    .orderBy(asc(s.categories.position), asc(s.categories.name));
}

export async function listCollections(): Promise<AdminTaxonomyItem[]> {
  const rows = await db()
    .select({
      id: s.collections.id,
      slug: s.collections.slug,
      name: s.collections.name,
      description: s.collections.description,
      isActive: s.collections.isActive,
      position: s.collections.position,
      startsAt: s.collections.startsAt,
      endsAt: s.collections.endsAt,
      productCount: sql<number>`(select count(*)::int from product_collections where product_collections.collection_id = "collections"."id")`,
    })
    .from(s.collections)
    .orderBy(asc(s.collections.position), asc(s.collections.name));
  return rows.map((row) => ({ ...row, startsAt: iso(row.startsAt), endsAt: iso(row.endsAt) }));
}

export async function saveCategory(id: string | null, input: TaxonomyInput) {
  const values = {
    name: input.name,
    slug: slugify(input.slug || input.name),
    description: input.description,
    isActive: input.isActive,
    position: input.position,
  };
  try {
    if (id) await db().update(s.categories).set(values).where(eq(s.categories.id, id));
    else await db().insert(s.categories).values(values);
  } catch (error) {
    if (isUniqueViolation(error))
      throw new SettingsError(`The URL /shop/${values.slug} is already used.`);
    throw error;
  }
}

export async function saveCollection(id: string | null, input: TaxonomyInput) {
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
    throw new SettingsError("The end date must be after the start date.");
  }
  const values = {
    name: input.name,
    slug: slugify(input.slug || input.name),
    description: input.description,
    isActive: input.isActive,
    position: input.position,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
  };
  try {
    if (id) await db().update(s.collections).set(values).where(eq(s.collections.id, id));
    else await db().insert(s.collections).values(values);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new SettingsError(`The URL /collections/${values.slug} is already used.`);
    }
    throw error;
  }
}

/** Categories can only go once nothing is filed under them. */
export async function deleteCategory(id: string) {
  const [used] = await db()
    .select({ total: count() })
    .from(s.products)
    .where(eq(s.products.categoryId, id));
  if (used?.total) {
    throw new SettingsError("Move or archive this category’s products first, or just hide it.");
  }
  await db().delete(s.categories).where(eq(s.categories.id, id));
}

export async function deleteCollection(id: string) {
  // Removing a collection only unlinks products; the products themselves stay.
  await db().delete(s.collections).where(eq(s.collections.id, id));
}

/* ─── Customers ───────────────────────────────────────────────────────────── */

/**
 * Most cash-on-delivery customers never make an account, so a customer is
 * identified by the phone number their orders were placed with.
 */
export async function listCustomers(query?: string): Promise<AdminCustomer[]> {
  const term = query ? `%${query.replace(/[%_\\]/g, "\\$&")}%` : null;
  const digits = query?.replace(/\D/g, "") ?? "";
  const rows = await db()
    .select({
      phone: s.orders.phone,
      name: sql<string>`(array_agg(${s.orders.shippingAddress}->>'fullName' order by ${s.orders.placedAt} desc))[1]`,
      email: sql<
        string | null
      >`(array_agg(${s.orders.email} order by ${s.orders.placedAt} desc) filter (where ${s.orders.email} is not null))[1]`,
      orders: sql<number>`count(*)::int`,
      spent: sql<number>`coalesce(sum(${s.orders.total}) filter (where ${s.orders.status} in ('confirmed','processing','shipped','delivered')), 0)::int`,
      cancelled: sql<number>`(count(*) filter (where ${s.orders.status} = 'cancelled'))::int`,
      lastOrderAt: sql<Date>`max(${s.orders.placedAt})`,
    })
    .from(s.orders)
    .where(
      term
        ? or(
            ilike(sql`${s.orders.shippingAddress}->>'fullName'`, term),
            ilike(s.orders.email, term),
            ...(digits.length >= 4 ? [ilike(s.orders.phone, `%${digits.slice(-9)}%`)] : []),
          )
        : undefined,
    )
    .groupBy(s.orders.phone)
    .orderBy(desc(sql`max(${s.orders.placedAt})`))
    .limit(200);
  return rows.map((row) => ({ ...row, lastOrderAt: new Date(row.lastOrderAt).toISOString() }));
}
