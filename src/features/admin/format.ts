import { formatMoney } from "@/lib/money";

/**
 * Dates are formatted in a fixed timezone (Cairo, where the business runs),
 * so the server render and the browser always produce the same text.
 */
const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

export const egp = (amount: number, currency = "EGP") => formatMoney({ amount, currency });

/** +201012345678 → "010 1234 5678", the way staff read numbers aloud. */
export function displayPhone(e164: string) {
  const local = e164.startsWith("+20") ? `0${e164.slice(3)}` : e164;
  return local.length === 11
    ? `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`
    : local;
}

/** WhatsApp deep link — the usual way to reach customers in Egypt. */
export const whatsappHref = (e164: string) => `https://wa.me/${e164.replace(/^\+/, "")}`;
