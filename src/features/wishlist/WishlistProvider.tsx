import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "quattro:wishlist";
const LIMIT = 100;

type WishlistApi = {
  /** Saved product ids, newest first. Empty until loaded in the browser. */
  ids: string[];
  /** False during the server render and until the saved list has loaded. */
  ready: boolean;
  signedIn: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
};

const WishlistContext = createContext<WishlistApi | null>(null);

function readLocal(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try {
    if (ids.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, LIMIT)));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage disabled: the list lasts for this page view only.
  }
}

async function call(method: string, path: string, body?: unknown): Promise<string[] | null> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!response?.ok) return null;
  const data = (await response.json().catch(() => null)) as { ids?: string[] } | null;
  return data?.ids ?? null;
}

/**
 * Saved items. Signed-in shoppers keep them on their account; guests keep them
 * in this browser, and those are added to the account when they sign in.
 * Loaded after hydration, so nothing here affects the server-rendered page.
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/wishlist", { credentials: "same-origin" }).catch(
        () => null,
      );
      const data = response?.ok
        ? ((await response.json().catch(() => null)) as { signedIn: boolean; ids: string[] } | null)
        : null;
      const local = readLocal();
      let next = local;
      if (data?.signedIn) {
        next = data.ids;
        if (local.length) {
          const merged = await call("POST", "/api/wishlist/merge", { ids: local.slice(0, LIMIT) });
          if (merged) {
            next = merged;
            writeLocal([]);
          }
        }
      }
      if (cancelled) return;
      setSignedIn(Boolean(data?.signedIn));
      setIds(next);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (productId: string) => {
      const saved = ids.includes(productId);
      const optimistic = saved
        ? ids.filter((id) => id !== productId)
        : [productId, ...ids].slice(0, LIMIT);
      setIds(optimistic);
      if (!saved) track("wishlist_add");
      if (!signedIn) {
        writeLocal(optimistic);
        return;
      }
      const path = `/api/wishlist/items/${encodeURIComponent(productId)}`;
      // PUT carries an (empty) JSON body: the API only accepts JSON writes.
      const result = await (saved ? call("DELETE", path) : call("PUT", path, {}));
      // The server's answer wins; on failure, undo the optimistic change.
      setIds(result ?? ids);
    },
    [ids, signedIn],
  );

  const value = useMemo<WishlistApi>(
    () => ({ ids, ready, signedIn, has: (id) => ids.includes(id), toggle }),
    [ids, ready, signedIn, toggle],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider");
  return context;
}
