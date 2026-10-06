import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard for state-changing endpoints.
 *
 * Session cookies are SameSite=Lax, which already stops cross-site POSTs from
 * carrying them; this adds two independent checks on top:
 *  - a browser-sent Origin header must match this host, and
 *  - the body must be JSON, which a plain HTML form cannot produce without a
 *    CORS preflight that this server never grants.
 */
export async function requireSameOrigin(request: FastifyRequest, reply: FastifyReply) {
  if (SAFE_METHODS.has(request.method)) return;

  const origin = request.headers.origin;
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost !== request.host) {
      return reply.status(403).send({ error: "Cross-site request blocked." });
    }
  }

  const type = request.headers["content-type"];
  if (request.method !== "DELETE" && !type?.startsWith("application/json")) {
    return reply.status(415).send({ error: "Expected a JSON request body." });
  }
}

/** 256-bit random token, URL-safe. */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

/** Tokens are stored hashed, so a database leak does not expose live cookies. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
