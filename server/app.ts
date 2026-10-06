import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import { devAssets, loadProductionAssets } from "./assets.js";
import { serverEnv } from "./env.js";
import { uploadsDir } from "./media/storage.js";
import { sendRendered, type RenderFn } from "./render.js";
import { accountRoutes } from "./routes/account.js";
import { wishlistRoutes } from "./routes/wishlist.js";
import { adminContentRoutes, contentRoutes } from "./routes/content.js";
import { adminRoutes } from "./routes/admin.js";
import { adminProductRoutes } from "./routes/admin-products.js";
import { adminSettingsRoutes } from "./routes/admin-settings.js";
import { authRoutes } from "./routes/auth.js";
import { cartRoutes } from "./routes/cart.js";
import { catalogRoutes } from "./routes/catalog.js";
import { checkoutRoutes } from "./routes/checkout.js";
import { orderRoutes } from "./routes/orders.js";
import { healthRoutes } from "./routes/health.js";
import { seoRoutes } from "./routes/seo.js";

/**
 * Build output is resolved from the working directory, not from this module:
 * in dev this file is `server/app.ts`, in production it is bundled to
 * `dist/node/index.js`, so a module-relative path would differ between them.
 * Both are started from the project root (the Docker image sets WORKDIR /app).
 */
const rootDir = process.env.QUATTRO_ROOT ?? process.cwd();
const clientDir = path.join(rootDir, "dist/client");
const ssrEntry = path.join(rootDir, "dist/server/entry.server.js");

/** Module and asset requests served by Vite's dev middleware. */
const VITE_ASSET = /^\/(?:src|node_modules|@vite|@fs|@id|@react-refresh)(?:\/|$)/;

export async function buildApp(): Promise<FastifyInstance> {
  const env = serverEnv();
  // The analytics script and its event endpoint share one origin.
  const analyticsOrigin =
    env.ANALYTICS_SCRIPT_URL && env.ANALYTICS_WEBSITE_ID
      ? [new URL(env.ANALYTICS_SCRIPT_URL).origin]
      : [];
  const isDev = env.NODE_ENV === "development";

  const app = Fastify({
    logger: isDev ? { level: "info", transport: { target: "pino-pretty" } } : { level: "info" },
    // Caddy terminates TLS and sets X-Forwarded-*; trust it so request.protocol is right.
    trustProxy: true,
    // Access logs come from Caddy in production. In dev, log pages and API calls
    // only: a page load pulls hundreds of Vite modules, and logging each one
    // slows the dev server down enough to time out parallel browser tests.
    logController: new LogController({
      disableRequestLogging: isDev ? (request) => VITE_ASSET.test(request.url) : true,
    }),
  });

  await app.register(cookie);
  await app.register(helmet, {
    // Vite's dev client injects inline scripts and opens a websocket, so CSP is
    // only enforced in production. There, `enableCSPNonces` issues a per-request
    // nonce (reply.cspNonce) that the hydration script is tagged with, so no
    // 'unsafe-inline' is needed.
    contentSecurityPolicy: isDev
      ? false
      : {
          useDefaults: false,
          /*
           * Spelled out in full on purpose. @fastify/helmet appends the nonce by
           * *replacing* script-src/style-src when they are absent, so omitting
           * them here would leave the nonce as the only allowed source and block
           * our own bundle. A nonce nullifies 'unsafe-inline' but not 'self'.
           */
          directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", ...analyticsOrigin],
            "style-src": ["'self'"],
            /*
             * Inline `style` attributes are governed by style-src-attr, which
             * helmet defaults to 'none'. Motion and Base UI animate by writing
             * them, so they must be allowed; <style> elements stay restricted.
             */
            "style-src-attr": ["'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:"],
            "font-src": ["'self'"],
            "connect-src": ["'self'", ...analyticsOrigin],
            "form-action": ["'self'"],
            "base-uri": ["'self'"],
            "object-src": ["'none'"],
            "frame-ancestors": ["'none'"],
            "upgrade-insecure-requests": [],
          },
        },
    enableCSPNonces: !isDev,
    // Cross-origin isolation headers break third-party images/embeds; revisit per feature.
    crossOriginEmbedderPolicy: false,
  });

  // Browser features the shop never uses, switched off for every page and frame.
  app.addHook("onSend", async (_request, reply) => {
    reply.header(
      "permissions-policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    );
  });

  await app.register(rateLimit, {
    // Opt-in per route (checkout, order lookup, sign-in), not a blanket limit.
    global: false,
    /*
     * Behind Cloudflare every request arrives from an edge IP, so key on the
     * visitor's address Cloudflare reports. Only trustworthy because the origin
     * should accept traffic from Cloudflare alone (see README → Deployment).
     */
    keyGenerator: (request) => {
      // Spoofable unless Cloudflare is guaranteed to sit in front and set it.
      const forwarded = env.BEHIND_CLOUDFLARE ? request.headers["cf-connecting-ip"] : undefined;
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? request.ip;
    },
    // Local development and the e2e suite run from loopback; production never does.
    allowList: (_request, key) => isDev && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(key),
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      error: `Too many attempts. Please wait ${context.after} and try again.`,
    }),
  });

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(catalogRoutes, { prefix: "/api/catalog" });
  await app.register(cartRoutes, { prefix: "/api/cart" });
  await app.register(checkoutRoutes, { prefix: "/api/checkout" });
  await app.register(orderRoutes, { prefix: "/api/orders" });
  await app.register(accountRoutes, { prefix: "/api/account" });
  await app.register(wishlistRoutes, { prefix: "/api/wishlist" });
  await app.register(contentRoutes, { prefix: "/api/content" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(adminProductRoutes, { prefix: "/api/admin/products" });
  await app.register(adminSettingsRoutes, { prefix: "/api/admin" });
  await app.register(adminContentRoutes, { prefix: "/api/admin" });
  await app.register(seoRoutes);

  let render: RenderFn;
  let assets = devAssets();

  if (isDev) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: {
        middlewareMode: true,
        // Hot-reload messages ride on the site's own port instead of Vite's
        // separate 24678 one, so they also reach phones through a tunnel. Without
        // this, a dependency re-optimisation left open pages stranded with
        // "Outdated Optimize Dep" errors and nothing interactive.
        hmr: { server: app.server },
      },
      appType: "custom",
    });
    app.addHook("onClose", async () => {
      await vite.close();
    });

    const middie = await import("@fastify/middie");
    await app.register(middie.default);
    app.use(vite.middlewares);

    render = async (request, rootData) => {
      const mod = (await vite.ssrLoadModule("/src/entry.server.tsx")) as {
        render: RenderFn;
      };
      try {
        return await mod.render(request, rootData);
      } catch (error) {
        if (error instanceof Error) vite.ssrFixStacktrace(error);
        throw error;
      }
    };

    app.addHook("onClose", () => vite.close());
  } else {
    assets = await loadProductionAssets(clientDir);

    /*
     * One registration for the whole client build. `wildcard: false` makes the
     * plugin register a route per file instead of a `/*` catch-all, which would
     * collide with the SSR handler below.
     *
     * Everything under /assets/ has a content hash in its name, so it can be
     * cached forever; files copied from public/ (favicon, robots.txt) keep
     * their names across deploys and get a short TTL instead.
     */
    await app.register(fastifyStatic, {
      root: clientDir,
      prefix: "/",
      index: false,
      wildcard: false,
      decorateReply: false,
      // Set Cache-Control here rather than letting the plugin derive it.
      cacheControl: false,
      setHeaders(reply, pathName) {
        const relative = path.relative(clientDir, pathName).replaceAll("\\", "/");
        reply.header(
          "cache-control",
          relative.startsWith("assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
        );
      },
    });

    // Resolved at runtime, so Vite must not try to bundle it into the server build.
    render = (
      (await import(/* @vite-ignore */ pathToFileURL(ssrEntry).href)) as {
        render: RenderFn;
      }
    ).render;
  }

  // Everything that is not an API route or a static asset is rendered by React.
  // Uploaded product images. Keys are random UUIDs and never reused, so each
  // file can be cached forever by browsers and the CDN.
  await mkdir(uploadsDir(), { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadsDir(),
    prefix: "/media/",
    decorateReply: false,
    index: false,
    immutable: true,
    maxAge: "365d",
  });

  // Unknown /api/* paths are JSON 404s, never an HTML page.
  app.all("/api/*", async (_request, reply) => reply.status(404).send({ error: "Not found" }));

  // Everything else is rendered by React.
  app.get("/*", async (request, reply) => sendRendered(app, request, reply, render, assets));

  return app;
}
