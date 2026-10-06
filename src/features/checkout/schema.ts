import { z } from "zod";

/** Egypt's 27 governorates — used for the address and to match delivery rates. */
export const GOVERNORATES = [
  "Alexandria",
  "Aswan",
  "Asyut",
  "Beheira",
  "Beni Suef",
  "Cairo",
  "Dakahlia",
  "Damietta",
  "Faiyum",
  "Gharbia",
  "Giza",
  "Ismailia",
  "Kafr El Sheikh",
  "Luxor",
  "Matrouh",
  "Minya",
  "Monufia",
  "New Valley",
  "North Sinai",
  "Port Said",
  "Qalyubia",
  "Qena",
  "Red Sea",
  "Sharqia",
  "Sohag",
  "South Sinai",
  "Suez",
] as const;

/**
 * Egyptian mobile numbers: 010 / 011 / 012 / 015 followed by 8 digits.
 * Accepts local (01…), +20 and 0020 forms, with spaces or dashes, and
 * normalises to E.164 (+201…) so one customer is always one number.
 */
export function normalizeEgyptianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  const local = digits.replace(/^(\+20|0020|20)(?=1)/, "0");
  return /^01[0125]\d{8}$/.test(local) ? `+20${local.slice(1)}` : null;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const normalized = normalizeEgyptianMobile(value);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Enter an Egyptian mobile number, e.g. 010 1234 5678.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z
    .union([z.literal(""), z.email("Enter a valid email address, or leave it empty.")])
    .optional()
    .transform((value) => (value ? value.toLowerCase() : null)),
  governorate: z.enum(GOVERNORATES, { message: "Choose your governorate." }),
  city: z.string().trim().min(2, "Enter your city or area.").max(120),
  line1: z.string().trim().min(5, "Enter your street address.").max(200),
  line2: optionalText(200),
  note: optionalText(500),
  shippingRateId: z.uuid("Choose a delivery option."),
  paymentMethod: z.enum(["cod", "instapay"]).optional().default("cod"),
  marketingOptIn: z.boolean().optional().default(false),
  /** Signed-in shoppers only: keep this address for next time. */
  saveAddress: z.boolean().optional().default(false),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

/** Field → first error message, for rendering next to each input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** InstaPay transfer details, as configured in the admin. */
export type InstapayDetails = {
  address: string;
  accountName: string;
  note: string | null;
  /** Unpaid orders are cancelled after this many hours. */
  holdHours: number;
};

export type ShippingOption = {
  id: string;
  name: string;
  /** Minor units; already 0 when free-delivery thresholds or codes apply. */
  price: number;
  /** The rate's own price before any free-delivery rule. */
  basePrice: number;
  currency: string;
  etaMinDays: number | null;
  etaMaxDays: number | null;
};

export type OrderSummary = {
  number: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  placedAt: string;
  email: string | null;
  phone: string;
  shippingAddress: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    region: string;
    countryCode: string;
  };
  shippingRateName: string | null;
  items: {
    productName: string;
    variantLabel: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageKey: string | null;
  }[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  currency: string;
  couponCode: string | null;
  /** Present on InstaPay orders: where to send the money, and what was submitted. */
  instapay: (InstapayDetails & { reference: string | null }) | null;
};
