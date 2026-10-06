import type { Money } from "@/features/catalog/types";

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, locale: string, fractionDigits: number) {
  const key = `${locale}|${currency}|${fractionDigits}`;
  let instance = formatters.get(key);
  if (!instance) {
    instance = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, instance);
  }
  return instance;
}

/**
 * Format integer minor units for display: 125000 EGP → "EGP 1,250".
 * Whole amounts drop the decimals; anything else keeps two.
 * The locale is fixed per render so server and client output always match.
 */
export function formatMoney({ amount, currency }: Money, locale = "en-EG") {
  const fractionDigits = amount % 100 === 0 ? 0 : 2;
  // Intl inserts a non-breaking space after the code; keep it so "EGP" never wraps alone.
  return formatter(currency, locale, fractionDigits).format(amount / 100);
}

/** Percentage saved, rounded down so it is never overstated. */
export function percentOff(price: Money, compareAt: Money) {
  if (compareAt.amount <= price.amount) return 0;
  return Math.floor(((compareAt.amount - price.amount) / compareAt.amount) * 100);
}
