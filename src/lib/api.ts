/**
 * Isomorphic access to the Fastify API from route loaders.
 *
 * On the server, the render pipeline passes `apiFetch` through the static
 * handler's request context; it dispatches in-process (`app.inject`) with the
 * visitor's cookies, so SSR never makes a network round trip to itself.
 * In the browser there is no context, so loaders use plain `fetch`.
 */
import type { ShellData } from "@/root";

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

/** What the server hands every loader as `context`. */
export type ServerContext = {
  shell: ShellData;
  apiFetch: ApiFetch;
};

type LoaderArgs = { request: Request; context?: unknown };

function isServerContext(value: unknown): value is ServerContext {
  return typeof value === "object" && value !== null && "apiFetch" in value;
}

export async function apiFetch(args: LoaderArgs, path: string, init: RequestInit = {}) {
  const request = { ...init, signal: init.signal ?? args.request.signal };
  return isServerContext(args.context)
    ? args.context.apiFetch(path, request)
    : fetch(path, { credentials: "same-origin", ...request });
}

/**
 * GET JSON from the API. Failures are thrown as Responses, which React Router
 * routes to the nearest error boundary with the right status — so a missing
 * product renders the 404 page and the HTTP response is a real 404.
 */
export async function apiGet<T>(args: LoaderArgs, path: string): Promise<T> {
  const response = await apiFetch(args, path, { headers: { accept: "application/json" } });
  if (response.status === 404) throw new Response("Not found", { status: 404 });
  if (!response.ok) throw new Response("The service is unavailable", { status: response.status });
  return (await response.json()) as T;
}

/** Serialise only the params that have a value. */
export function toQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, value === true ? "1" : String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
