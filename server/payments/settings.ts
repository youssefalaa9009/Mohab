import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";

const KEY = "payments";

/** What staff configure in Admin → Payments. Every value is QUATTRO's own. */
export const paymentSettingsSchema = z
  .object({
    instapay: z.object({
      enabled: z.boolean(),
      /** InstaPay payment address (IPA), e.g. name@instapay, or a mobile number. */
      address: z.string().trim().max(100),
      /** Account holder name customers will see in their banking app. */
      accountName: z.string().trim().max(100),
      /** Extra guidance shown to customers (optional). */
      note: z.string().trim().max(500),
      /** Unpaid InstaPay orders are cancelled after this long, releasing their stock. */
      holdHours: z.number().int().min(1).max(168).default(48),
    }),
  })
  .refine((value) => !value.instapay.enabled || value.instapay.address.length >= 3, {
    path: ["instapay", "address"],
    message: "Add the InstaPay address before switching InstaPay on.",
  })
  .refine((value) => !value.instapay.enabled || value.instapay.accountName.length >= 2, {
    path: ["instapay", "accountName"],
    message: "Add the account name customers will see.",
  });

export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;

const DEFAULTS: PaymentSettings = {
  instapay: { enabled: false, address: "", accountName: "", note: "", holdHours: 48 },
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const [row] = await db()
    .select({ value: s.storeSettings.value })
    .from(s.storeSettings)
    .where(eq(s.storeSettings.key, KEY))
    .limit(1);
  const parsed = paymentSettingsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULTS;
}

export async function savePaymentSettings(value: PaymentSettings) {
  await db()
    .insert(s.storeSettings)
    .values({ key: KEY, value })
    .onConflictDoUpdate({
      target: s.storeSettings.key,
      set: { value, updatedAt: sql`now()` },
    });
  return value;
}

/** InstaPay details for customers, or null when it isn't offered. */
export async function instapayDetails() {
  const { instapay } = await getPaymentSettings();
  return instapay.enabled
    ? {
        address: instapay.address,
        accountName: instapay.accountName,
        note: instapay.note || null,
        holdHours: instapay.holdHours,
      }
    : null;
}
