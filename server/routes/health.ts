import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  /** Liveness probe for Docker/compose health checks. Does not touch the database. */
  app.get("/healthz", async () => ({ status: "ok", uptime: process.uptime() }));
}
