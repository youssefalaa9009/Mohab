/**
 * True for a Postgres unique-constraint violation (SQLSTATE 23505). Drizzle
 * wraps driver errors ("Failed query: …"), so the code is usually on `cause`.
 */
export function isUniqueViolation(error: unknown): boolean {
  const code =
    (error as { code?: string }).code ?? (error as { cause?: { code?: string } }).cause?.code;
  return code === "23505";
}
