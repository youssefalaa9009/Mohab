import { buildApp } from "./app.js";
import { serverEnv } from "./env.js";
import { startJobs } from "./jobs.js";

const env = serverEnv();
const app = await buildApp();
let stopJobs = () => {};

// Finish in-flight requests before exiting so rolling deploys don't drop responses.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    stopJobs();
    // Lingering keep-alive or WebSocket connections must not hold the port:
    // in dev that blocks the watcher's restart (EADDRINUSE).
    setTimeout(() => process.exit(0), 5000).unref();
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  stopJobs = startJobs(app);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
