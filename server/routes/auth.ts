import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

/**
 * Hands /api/auth/* to Better Auth. It runs its own origin checks
 * (trustedOrigins) and rate limits, so the generic CSRF hook isn't applied.
 */
export async function authRoutes(app: FastifyInstance) {
  app.route({
    method: ["GET", "POST"],
    url: "/*",
    async handler(request, reply) {
      const url = new URL(request.url, `${request.protocol}://${request.host}`);
      const response = await auth().handler(
        new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        }),
      );

      reply.status(response.status);
      // Fastify appends repeated set-cookie headers rather than overwriting them.
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.header("cache-control", "private, no-store");
      return reply.send(response.body ? await response.text() : null);
    },
  });
}
