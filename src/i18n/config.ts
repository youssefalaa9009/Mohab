/**
 * Locale configuration. The storefront launches in English; the structure here
 * (and the `*_translations` database tables) is what makes adding Arabic a data
 * and translation task rather than a rewrite.
 *
 * All layout CSS uses logical properties, so switching `dir` is enough to flip
 * the interface. Nothing may hardcode left/right.
 */
export const LOCALES = ["en"] as const satisfies readonly string[];

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Locales written right-to-left. Add "ar" here when Arabic is enabled. */
const RTL_LOCALES = new Set<string>(["ar", "he", "fa", "ur"]);

export function directionOf(locale: string): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Currency is a launch decision; prices are stored in minor units with a code. */
export const DEFAULT_CURRENCY = "EGP";
