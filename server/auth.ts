import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "./db/client.js";
import { account, session, user, verification } from "./db/schema/index.js";
import { escapeHtml, sendEmail } from "./email/send.js";
import { isProduction, serverEnv } from "./env.js";

/** Development-only fallback so a fresh clone runs without configuration. Never used in production (env validation refuses to start). */
const DEV_SECRET = "quattro-development-only-secret-do-not-use-in-production";

function createAuth() {
  const env = serverEnv();
  return betterAuth({
    appName: "QUATTRO",
    baseURL: env.SITE_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
    trustedOrigins: [env.SITE_URL],
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user: recipient, url }) => {
        await sendEmail(
          {
            to: recipient.email,
            subject: "Reset your QUATTRO password",
            text: `Use this link to choose a new password. It expires in one hour.\n\n${url}\n\nIf you didn't ask for this, ignore this email.`,
            html: `<p>Use this link to choose a new password. It expires in one hour.</p><p><a href="${escapeHtml(url)}">Reset your password</a></p><p>If you didn’t ask for this, ignore this email.</p>`,
          },
          console,
        );
      },
    },
    user: {
      additionalFields: {
        // Never accepted from sign-up or profile updates: admins are promoted
        // explicitly (npm run admin:create), so nobody can register as staff.
        role: {
          type: ["customer", "admin"],
          required: false,
          defaultValue: "customer",
          input: false,
        },
        phone: { type: "string", required: false },
        locale: { type: "string", required: false, defaultValue: "en", input: false },
        marketingOptIn: { type: "boolean", required: false, defaultValue: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh the expiry at most daily
    },
    rateLimit: {
      enabled: isProduction(),
      window: 60,
      max: 30,
      // Sign-in attempts get a much tighter budget than general auth traffic.
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    },
    advanced: {
      cookiePrefix: "quattro",
      useSecureCookies: isProduction(),
      // Caddy replaces any client-sent X-Forwarded-For; CF-Connecting-IP is only
      // trustworthy when Cloudflare is guaranteed to be in front.
      ipAddress: {
        ipAddressHeaders: env.BEHIND_CLOUDFLARE
          ? ["cf-connecting-ip", "x-forwarded-for"]
          : ["x-forwarded-for"],
      },
    },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Lazily created, like the database pool, so tooling never needs auth configured. */
export function auth() {
  instance ??= createAuth();
  return instance;
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
};

export async function currentUser(request: FastifyRequest): Promise<SessionUser | null> {
  const result = await auth().api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!result) return null;
  const { id, name, email, role } = result.user as typeof result.user & {
    role: SessionUser["role"];
  };
  return { id, name, email, role };
}

/** Route guard: staff only. Unauthenticated → 401, signed in but not staff → 403. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const viewer = await currentUser(request);
  if (!viewer) return reply.status(401).send({ error: "Please sign in." });
  if (viewer.role !== "admin") return reply.status(403).send({ error: "Staff only." });
  request.viewer = viewer;
}

declare module "fastify" {
  interface FastifyRequest {
    viewer?: SessionUser;
  }
}
