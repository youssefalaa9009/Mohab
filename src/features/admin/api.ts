import { redirect, type LoaderFunctionArgs } from "react-router";
import { apiFetch } from "@/lib/api";

/**
 * GET from the admin API inside a loader. A missing or expired session sends
 * the visitor to the sign-in page, then back to where they were going.
 */
export async function adminGet<T>(args: LoaderFunctionArgs, path: string): Promise<T> {
  const response = await apiFetch(args, path, { headers: { accept: "application/json" } });
  if (response.status === 401) {
    const url = new URL(args.request.url);
    throw redirect(`/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  if (response.status === 403) throw new Response("Staff only", { status: 403 });
  if (response.status === 404) throw new Response("Not found", { status: 404 });
  if (!response.ok)
    throw new Response("The admin service is unavailable", { status: response.status });
  return (await response.json()) as T;
}

/** POST JSON from the browser. Resolves to the parsed body, or throws with the server's message. */
export async function adminPost<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (response.status === 401) {
    window.location.assign(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
  }
  if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data;
}
