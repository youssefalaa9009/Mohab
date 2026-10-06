import { desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { db } from "../db/client.js";
import * as s from "../db/schema/index.js";
import { escapeHtml, sendEmail } from "../email/send.js";
import { serverEnv } from "../env.js";
import { sendCsv } from "../http/csv.js";
import { requireSameOrigin } from "../http/security.js";
import { unsubscribeUrl, validUnsubscribeToken } from "../newsletter/unsubscribe.js";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address."));

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email,
  subject: z.string().trim().min(2, "Add a subject.").max(160),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(5000),
  /** Honeypot: hidden from people, filled in by naive bots. */
  website: z.string().max(0).optional(),
});

function fieldErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
  return fields;
}

/** Public: contact form and newsletter signup. */
export async function contentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSameOrigin);

  app.post(
    "/contact",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const body = contactSchema.safeParse(request.body);
      if (!body.success) {
        const fields = fieldErrors(body.error);
        // A filled honeypot gets the same "thanks" as a real message, and is dropped.
        if (fields.website) return reply.status(201).send({ ok: true });
        return reply.status(400).send({ error: "Please check the highlighted fields.", fields });
      }
      const { website: _honeypot, ...message } = body.data;
      await db().insert(s.contactMessages).values(message);

      const staff = serverEnv().ORDER_NOTIFY_EMAIL;
      if (staff) {
        void sendEmail(
          {
            to: staff,
            subject: `Contact form: ${message.subject}`,
            text: `${message.name} <${message.email}> wrote:\n\n${message.message}`,
            html: `<p>${escapeHtml(message.name)} &lt;${escapeHtml(message.email)}&gt; wrote:</p><p style="white-space:pre-wrap">${escapeHtml(message.message)}</p>`,
          },
          request.log,
        );
      }
      return reply.status(201).send({ ok: true });
    },
  );

  app.post(
    "/newsletter",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const body = z
        .object({ email, source: z.string().trim().max(40).optional() })
        .safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: "Enter a valid email address." });
      }
      // Re-subscribing renews consent. The reply never says whether the address was known.
      await db()
        .insert(s.newsletterSubscribers)
        .values({ email: body.data.email, source: body.data.source ?? null })
        .onConflictDoUpdate({
          target: s.newsletterSubscribers.email,
          set: { status: "subscribed", consentAt: sql`now()`, unsubscribedAt: null },
        });
      return reply.status(201).send({ ok: true });
    },
  );

  /** From the signed link in newsletter emails. Same reply whether or not the address was subscribed. */
  app.post("/newsletter/unsubscribe", async (request, reply) => {
    const body = z.object({ email, token: z.string().min(10).max(200) }).safeParse(request.body);
    if (!body.success || !validUnsubscribeToken(body.data.email, body.data.token)) {
      return reply.status(400).send({ error: "This unsubscribe link isn’t valid." });
    }
    await db()
      .update(s.newsletterSubscribers)
      .set({ status: "unsubscribed", unsubscribedAt: sql`now()` })
      .where(eq(s.newsletterSubscribers.email, body.data.email));
    return { ok: true };
  });
}

/** Staff: contact inbox and subscriber list. */
export async function adminContentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSameOrigin);
  app.addHook("preHandler", requireAdmin);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
  });

  app.get("/messages", async () => {
    const rows = await db()
      .select()
      .from(s.contactMessages)
      .orderBy(desc(s.contactMessages.createdAt))
      .limit(200);
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  });

  app.patch<{ Params: { id: string } }>("/messages/:id", async (request, reply) => {
    const id = z.uuid().safeParse(request.params.id);
    const body = z.object({ status: z.enum(["new", "handled"]) }).safeParse(request.body);
    if (!id.success || !body.success) return reply.status(400).send({ error: "Invalid request." });
    const [row] = await db()
      .update(s.contactMessages)
      .set({ status: body.data.status })
      .where(eq(s.contactMessages.id, id.data))
      .returning({ id: s.contactMessages.id });
    return row ? { ok: true } : reply.status(404).send({ error: "Message not found." });
  });

  const subscribers = () =>
    db().select().from(s.newsletterSubscribers).orderBy(desc(s.newsletterSubscribers.consentAt));

  app.get("/subscribers", async () => {
    const rows = await subscribers().limit(500);
    const [counts] = await db()
      .select({
        subscribed: sql<number>`count(*) filter (where status = 'subscribed')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(s.newsletterSubscribers);
    return {
      counts: counts ?? { subscribed: 0, total: 0 },
      rows: rows.map((row) => ({
        ...row,
        consentAt: row.consentAt.toISOString(),
        unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
      })),
    };
  });

  /** Honour unsubscribe requests that arrive by email or phone. */
  app.patch<{ Params: { id: string } }>("/subscribers/:id", async (request, reply) => {
    const id = z.uuid().safeParse(request.params.id);
    const body = z
      .object({ status: z.enum(["subscribed", "unsubscribed"]) })
      .safeParse(request.body);
    if (!id.success || !body.success) return reply.status(400).send({ error: "Invalid request." });
    const unsubscribed = body.data.status === "unsubscribed";
    const [row] = await db()
      .update(s.newsletterSubscribers)
      .set({ status: body.data.status, unsubscribedAt: unsubscribed ? sql`now()` : null })
      .where(eq(s.newsletterSubscribers.id, id.data))
      .returning({ id: s.newsletterSubscribers.id });
    return row ? { ok: true } : reply.status(404).send({ error: "Subscriber not found." });
  });

  /** Everyone currently subscribed, for importing into an email tool. */
  app.get("/subscribers.csv", async (_request, reply) => {
    const rows = await subscribers().where(eq(s.newsletterSubscribers.status, "subscribed"));
    return sendCsv(
      reply,
      "quattro-subscribers.csv",
      ["email", "source", "consent_at", "unsubscribe_url"],
      rows.map((row) => [
        row.email,
        row.source ?? "",
        row.consentAt.toISOString(),
        unsubscribeUrl(row.email),
      ]),
    );
  });
}
