import "server-only";
import { z } from "zod";

/**
 * Server environment, validated on first use (not at import time) so the build
 * and database-free pages never require production secrets.
 * Later phases extend this schema as auth, email and payments come online.
 */
const serverSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing server environment variables: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
