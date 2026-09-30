import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { messageStatus, subscriberStatus } from "./shared";

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid().primaryKey().defaultRandom(),
  /** Stored lower-case. */
  email: text().notNull().unique(),
  status: subscriberStatus().default("subscribed").notNull(),
  source: text(),
  consentAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  unsubscribedAt: timestamp({ withTimezone: true }),
});

export const contactMessages = pgTable("contact_messages", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull(),
  subject: text().notNull(),
  message: text().notNull(),
  status: messageStatus().default("new").notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
