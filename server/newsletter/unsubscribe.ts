import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "../env.js";

/** Same development fallback as auth: production refuses to start without a secret. */
const DEV_SECRET = "quattro-development-only-secret-do-not-use-in-production";

function sign(email: string) {
  const secret = serverEnv().BETTER_AUTH_SECRET ?? DEV_SECRET;
  return createHmac("sha256", secret)
    .update(`newsletter-unsubscribe:${email.toLowerCase()}`)
    .digest("base64url");
}

/** Signed link for one address: valid until the secret changes, no database lookup needed. */
export function unsubscribeUrl(email: string) {
  const params = new URLSearchParams({ email, token: sign(email) });
  return `${serverEnv().SITE_URL}/newsletter/unsubscribe?${params}`;
}

export function validUnsubscribeToken(email: string, token: string) {
  const expected = Buffer.from(sign(email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
