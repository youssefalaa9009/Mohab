import { and, asc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  EMPTY_CART,
  MAX_LINE_QUANTITY,
  type CartLine,
  type CartView,
} from "../../src/features/cart/types.js";
import type { ImageRef, StockLevel } from "../../src/features/catalog/types.js";
import { slugify } from "../catalog/repository.js";
import { evaluateCoupon, findCoupon } from "../commerce/coupons.js";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";
import { isProduction } from "../env.js";
import { hashToken, newToken } from "../http/security.js";

export const CART_COOKIE = "quattro_cart";
const CART_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days
const LOW_STOCK_THRESHOLD = 3;

type CartRow = typeof s.carts.$inferSelect;

export class CartError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

/* ─── Identity ────────────────────────────────────────────────────────────── */

export async function findCart(request: FastifyRequest): Promise<CartRow | null> {
  const token = request.cookies[CART_COOKIE];
  if (!token) return null;
  const [cart] = await db()
    .select()
    .from(s.carts)
    .where(and(eq(s.carts.tokenHash, hashToken(token)), eq(s.carts.status, "active")))
    .limit(1);
  return cart ?? null;
}

/** Find the visitor's bag, creating one (and its cookie) on first add. */
export async function ensureCart(request: FastifyRequest, reply: FastifyReply): Promise<CartRow> {
  const existing = await findCart(request);
  if (existing) return existing;

  const token = newToken();
  const [cart] = await db()
    .insert(s.carts)
    .values({ tokenHash: hashToken(token) })
    .returning();
  reply.setCookie(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: CART_MAX_AGE_SECONDS,
  });
  return cart!;
}

export function clearCartCookie(reply: FastifyReply) {
  reply.clearCookie(CART_COOKIE, { path: "/" });
}

/* ─── Reading ─────────────────────────────────────────────────────────────── */

function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return "out";
  return stock <= LOW_STOCK_THRESHOLD ? "low" : "in";
}

export type PricedCart = {
  view: CartView;
  /** Raw data the checkout needs to snapshot an order. */
  lines: (CartLine & { sku: string; productId: string; imageKey: string | null })[];
  couponId: string | null;
  freeShipping: boolean;
};

/** Price the bag against live catalog data. Unavailable lines are shown but never charged. */
export async function priceCart(cart: CartRow | null): Promise<PricedCart> {
  if (!cart) return { view: EMPTY_CART, lines: [], couponId: null, freeShipping: false };

  const rows = await db()
    .select({
      itemId: s.cartItems.id,
      quantity: s.cartItems.quantity,
      variant: s.variants,
      productId: s.products.id,
      productSlug: s.products.slug,
      productName: s.products.name,
      productStatus: s.products.status,
      publishedAt: s.products.publishedAt,
      colorName: s.productColors.name,
    })
    .from(s.cartItems)
    .innerJoin(s.variants, eq(s.cartItems.variantId, s.variants.id))
    .innerJoin(s.products, eq(s.variants.productId, s.products.id))
    .leftJoin(s.productColors, eq(s.variants.colorId, s.productColors.id))
    .where(eq(s.cartItems.cartId, cart.id))
    .orderBy(asc(s.cartItems.addedAt));

  const productIds = [...new Set(rows.map((row) => row.productId))];
  const images = productIds.length
    ? await db()
        .select()
        .from(s.productImages)
        .where(inArray(s.productImages.productId, productIds))
        .orderBy(asc(s.productImages.position))
    : [];

  const imageFor = (productId: string, colorId: string | null): ImageRef | null => {
    const forProduct = images.filter((image) => image.productId === productId);
    const match =
      forProduct.find((image) => image.colorId === colorId && image.role === "primary") ??
      forProduct.find((image) => image.colorId === colorId) ??
      forProduct[0];
    return match
      ? { key: match.key, alt: match.alt, width: match.width, height: match.height }
      : null;
  };

  const now = Date.now();
  const lines: PricedCart["lines"] = rows.map((row) => {
    const live =
      row.variant.isActive &&
      row.productStatus === "active" &&
      row.publishedAt !== null &&
      row.publishedAt.getTime() <= now;
    const available = live && row.variant.stock > 0;
    const image = imageFor(row.productId, row.variant.colorId);
    return {
      id: row.itemId,
      variantId: row.variant.id,
      productId: row.productId,
      productSlug: row.productSlug,
      productName: row.productName,
      colorName: row.colorName,
      colorSlug: row.colorName ? slugify(row.colorName) : null,
      size: row.variant.size,
      sku: row.variant.sku,
      image,
      imageKey: image?.key ?? null,
      unitPrice: { amount: row.variant.price, currency: row.variant.currency },
      compareAtPrice:
        row.variant.compareAtPrice != null
          ? { amount: row.variant.compareAtPrice, currency: row.variant.currency }
          : null,
      quantity: row.quantity,
      lineTotal: { amount: row.variant.price * row.quantity, currency: row.variant.currency },
      stock: live ? stockLevel(row.variant.stock) : "out",
      maxQuantity: Math.max(0, Math.min(MAX_LINE_QUANTITY, live ? row.variant.stock : 0)),
      available,
    };
  });

  const currency = lines[0]?.unitPrice.currency ?? "EGP";
  const charged = lines.filter((line) => line.available);
  const subtotal = charged.reduce((sum, line) => sum + line.lineTotal.amount, 0);

  let discount = 0;
  let freeShipping = false;
  let couponId: string | null = null;
  let coupon: CartView["coupon"] = null;
  if (cart.couponId) {
    const [row] = await db()
      .select()
      .from(s.coupons)
      .where(eq(s.coupons.id, cart.couponId))
      .limit(1);
    if (row) {
      const outcome = evaluateCoupon(row, subtotal);
      coupon = {
        code: row.code,
        label: outcome.ok ? outcome.label : row.code,
        problem: outcome.ok ? null : outcome.reason,
        freeShipping: outcome.ok && outcome.freeShipping,
      };
      if (outcome.ok) {
        discount = outcome.discount;
        freeShipping = outcome.freeShipping;
        couponId = row.id;
      }
    }
  }

  return {
    view: {
      lines: lines.map(
        ({ sku: _sku, productId: _productId, imageKey: _imageKey, ...line }) => line,
      ),
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: { amount: subtotal, currency },
      discount: { amount: discount, currency },
      coupon,
      total: { amount: subtotal - discount, currency },
      hasUnavailable: lines.some((line) => !line.available || line.quantity > line.maxQuantity),
    },
    lines,
    couponId,
    freeShipping,
  };
}

/* ─── Writing ─────────────────────────────────────────────────────────────── */

/** A variant that can be bought right now, with its stock. */
async function purchasableVariant(variantId: string) {
  const [row] = await db()
    .select({ id: s.variants.id, stock: s.variants.stock })
    .from(s.variants)
    .innerJoin(s.products, eq(s.variants.productId, s.products.id))
    .where(
      and(
        eq(s.variants.id, variantId),
        eq(s.variants.isActive, true),
        eq(s.products.status, "active"),
        isNotNull(s.products.publishedAt),
        lte(s.products.publishedAt, sql`now()`),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function touch(cartId: string) {
  await db().update(s.carts).set({ updatedAt: new Date() }).where(eq(s.carts.id, cartId));
}

export async function addItem(cart: CartRow, variantId: string, quantity: number) {
  const variant = await purchasableVariant(variantId);
  if (!variant) throw new CartError("This item is no longer available.", 404);
  if (variant.stock <= 0) throw new CartError("Sorry — this size has just sold out.");

  const [existing] = await db()
    .select()
    .from(s.cartItems)
    .where(and(eq(s.cartItems.cartId, cart.id), eq(s.cartItems.variantId, variantId)))
    .limit(1);

  const limit = Math.min(MAX_LINE_QUANTITY, variant.stock);
  const wanted = (existing?.quantity ?? 0) + quantity;
  const next = Math.min(wanted, limit);
  if (existing && existing.quantity >= limit) {
    throw new CartError(
      limit === MAX_LINE_QUANTITY
        ? `You can add up to ${MAX_LINE_QUANTITY} of each item.`
        : "You already have all the available stock of this item in your bag.",
    );
  }

  await db()
    .insert(s.cartItems)
    .values({ cartId: cart.id, variantId, quantity: next })
    .onConflictDoUpdate({
      target: [s.cartItems.cartId, s.cartItems.variantId],
      set: { quantity: next },
    });
  await touch(cart.id);

  return next < wanted ? "Limited stock — we’ve added as many as are available." : undefined;
}

export async function updateItem(cart: CartRow, itemId: string, quantity: number) {
  const [item] = await db()
    .select({ id: s.cartItems.id, variantId: s.cartItems.variantId })
    .from(s.cartItems)
    .where(and(eq(s.cartItems.id, itemId), eq(s.cartItems.cartId, cart.id)))
    .limit(1);
  if (!item) throw new CartError("That item is no longer in your bag.", 404);

  if (quantity <= 0) {
    await db().delete(s.cartItems).where(eq(s.cartItems.id, item.id));
    await touch(cart.id);
    return undefined;
  }

  const variant = await purchasableVariant(item.variantId);
  const limit = Math.min(MAX_LINE_QUANTITY, variant?.stock ?? 0);
  if (limit <= 0) throw new CartError("This item is no longer available. Please remove it.");
  const next = Math.min(quantity, limit);
  await db().update(s.cartItems).set({ quantity: next }).where(eq(s.cartItems.id, item.id));
  await touch(cart.id);
  return next < quantity ? "Limited stock — quantity adjusted to what’s available." : undefined;
}

export async function removeItem(cart: CartRow, itemId: string) {
  await db()
    .delete(s.cartItems)
    .where(and(eq(s.cartItems.id, itemId), eq(s.cartItems.cartId, cart.id)));
  await touch(cart.id);
}

export async function applyCoupon(cart: CartRow, code: string) {
  const coupon = await findCoupon(code);
  const { view } = await priceCart(cart);
  const outcome = evaluateCoupon(coupon, view.subtotal.amount);
  if (!outcome.ok) throw new CartError(outcome.reason);
  await db().update(s.carts).set({ couponId: outcome.coupon.id }).where(eq(s.carts.id, cart.id));
  // Keep the caller's row in step: it is re-priced straight after this.
  cart.couponId = outcome.coupon.id;
}

export async function removeCoupon(cart: CartRow) {
  await db().update(s.carts).set({ couponId: null }).where(eq(s.carts.id, cart.id));
  cart.couponId = null;
}
