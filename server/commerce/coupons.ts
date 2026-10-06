import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";

type CouponRow = typeof s.coupons.$inferSelect;

export type CouponOutcome =
  | { ok: true; coupon: CouponRow; discount: number; freeShipping: boolean; label: string }
  | { ok: false; coupon: CouponRow | null; reason: string };

export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export async function findCoupon(code: string) {
  const [coupon] = await db()
    .select()
    .from(s.coupons)
    .where(eq(s.coupons.code, normalizeCode(code)))
    .limit(1);
  return coupon ?? null;
}

function formatMinor(amount: number) {
  return `EGP ${(amount / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function couponLabel(coupon: CouponRow) {
  if (coupon.type === "percent") return `${coupon.value}% off`;
  if (coupon.type === "fixed") return `${formatMinor(coupon.value)} off`;
  return "Free delivery";
}

/**
 * Decide whether a coupon applies to a subtotal (minor units) and what it is
 * worth. Pure apart from the "now" default, so the bag and checkout always
 * compute identical discounts. Per-customer limits need the customer's
 * identity and are enforced at checkout.
 */
export function evaluateCoupon(
  coupon: CouponRow | null,
  subtotal: number,
  now = new Date(),
): CouponOutcome {
  if (!coupon || !coupon.isActive) {
    return { ok: false, coupon, reason: "This code isn’t valid." };
  }
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ok: false, coupon, reason: "This code isn’t active yet." };
  }
  if (coupon.endsAt && coupon.endsAt <= now) {
    return { ok: false, coupon, reason: "This code has expired." };
  }
  if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) {
    return { ok: false, coupon, reason: "This code has reached its usage limit." };
  }
  if (coupon.minSubtotal !== null && subtotal < coupon.minSubtotal) {
    return {
      ok: false,
      coupon,
      reason: `This code needs a bag of at least ${formatMinor(coupon.minSubtotal)}.`,
    };
  }

  let discount = 0;
  if (coupon.type === "percent") discount = Math.floor((subtotal * coupon.value) / 100);
  if (coupon.type === "fixed") discount = Math.min(coupon.value, subtotal);

  return {
    ok: true,
    coupon,
    discount,
    freeShipping: coupon.type === "free_shipping",
    label: couponLabel(coupon),
  };
}

/**
 * Count one use, atomically re-checking the limit so two simultaneous orders
 * cannot both take the last use. Returns false if the limit was hit meanwhile.
 * Must run inside the order transaction.
 */
export async function claimCouponUse(
  tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0],
  couponId: string,
) {
  const updated = await tx
    .update(s.coupons)
    .set({ timesUsed: sql`${s.coupons.timesUsed} + 1` })
    .where(
      sql`${s.coupons.id} = ${couponId} and (${s.coupons.usageLimit} is null or ${s.coupons.timesUsed} < ${s.coupons.usageLimit})`,
    )
    .returning({ id: s.coupons.id });
  return updated.length > 0;
}
