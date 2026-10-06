const KEY = "quattro:recent-searches";
const LIMIT = 6;

/** Recent searches live in this browser only — nothing is sent anywhere. */
export function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item) => typeof item === "string").slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function rememberSearch(query: string) {
  const term = query.trim();
  if (term.length < 2) return;
  try {
    const next = [
      term,
      ...readRecent().filter((item) => item.toLowerCase() !== term.toLowerCase()),
    ];
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, LIMIT)));
  } catch {
    // Storage unavailable (private mode): recent searches simply stay empty.
  }
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
