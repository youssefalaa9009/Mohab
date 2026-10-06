CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
