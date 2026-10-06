import { z } from "zod";

/**
 * Server environment, validated on first use (not at import time) so builds and
 * tooling that never touch the database don't require production secrets.
 * Later phases extend this schema as auth, email and payments come online.
 *
 * This module is Node-only. Nothing under `server/` may be imported from `src/`.
 */
/** `KEY=` in an env file means "not set", not "set to an empty string". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Public origin used for canonical URLs, sitemap and Open Graph tags. */
    SITE_URL: z
      .url()
      .default("http://localhost:3000")
      .transform((url) => url.replace(/\/+$/, "")),
    /** Public base URL of uploaded media (R2 bucket / CDN). Optional until uploads exist. */
    MEDIA_URL: z
      .union([z.url(), z.literal("")])
      .optional()
      .transform((url) => (url ? url.replace(/\/+$/, "") : null)),
    /** Transactional email via Resend. Without a key, emails are logged instead of sent. */
    RESEND_API_KEY: optional(z.string()),
    EMAIL_FROM: z.string().default("QUATTRO <orders@example.com>"),
    /** Where new-order notifications go. Optional. */
    ORDER_NOTIFY_EMAIL: optional(z.email()),
    /**
     * True only when every request reaches the app through Cloudflare's proxy.
     * Then the visitor's IP comes from CF-Connecting-IP; otherwise that header
     * is client-controlled and ignored (Caddy's X-Forwarded-For is used).
     */
    BEHIND_CLOUDFLARE: z
      .enum(["true", "false", ""])
      .optional()
      .transform((value) => value === "true"),
    /**
     * Optional, cookieless analytics (Umami, self-hosted or cloud). Both must
     * be set to load the script; e.g. https://analytics.example.com/script.js
     */
    ANALYTICS_SCRIPT_URL: optional(z.url()),
    ANALYTICS_WEBSITE_ID: optional(z.string().max(100)),
    /** Signs session cookies. Required in production: `openssl rand -base64 32`. */
    BETTER_AUTH_SECRET: optional(z.string().min(32)),
  })
  .refine((env) => env.NODE_ENV !== "production" || !!env.BETTER_AUTH_SECRET, {
    path: ["BETTER_AUTH_SECRET"],
    message: "is required in production (at least 32 characters)",
  });

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  ");
    throw new Error(`Invalid server environment:\n  ${fields}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => serverEnv().NODE_ENV === "production";
