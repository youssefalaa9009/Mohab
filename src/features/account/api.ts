import { redirect, type LoaderFunctionArgs } from "react-router";
import { apiFetch } from "@/lib/api";

/** Loader GET for the account area: signed-out visitors go to sign-in, then back. */
export async function accountGet<T>(args: LoaderFunctionArgs, path: string): Promise<T> {
  const response = await apiFetch(args, path, { headers: { accept: "application/json" } });
  if (response.status === 401) {
    const url = new URL(args.request.url);
    throw redirect(`/account/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  if (response.status === 404) throw new Response("Not found", { status: 404 });
  if (!response.ok)
    throw new Response("Your account is unavailable right now", { status: response.status });
  return (await response.json()) as T;
}

export type FieldErrors = Record<string, string>;

export class RequestError extends Error {
  constructor(
    message: string,
    readonly fields: FieldErrors = {},
  ) {
    super(message);
  }
}

/** Better Auth error codes, in words a customer understands. */
const AUTH_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "An account with this email already exists. Try signing in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with this email already exists. Try signing in instead.",
  INVALID_EMAIL_OR_PASSWORD: "That email and password don’t match.",
  PASSWORD_TOO_SHORT: "Use at least 10 characters for your password.",
  INVALID_PASSWORD: "Your current password isn’t right.",
  INVALID_TOKEN: "This reset link has expired or was already used. Request a new one.",
  INVALID_EMAIL: "Enter a valid email address.",
};

/** POST/PUT/DELETE JSON from the browser; throws RequestError with the server's message. */
export async function send<T = unknown>(path: string, body: unknown, method = "POST"): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!response) throw new RequestError("Connection problem. Please try again.");
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    code?: string;
    fields?: FieldErrors;
  };
  if (response.status === 429)
    throw new RequestError("Too many attempts. Please wait a minute and try again.");
  if (!response.ok) {
    const message =
      (data.code && AUTH_MESSAGES[data.code]) ??
      data.error ??
      data.message ??
      "Something went wrong. Please try again.";
    throw new RequestError(message, data.fields);
  }
  return data as T;
}

/** Only same-site paths are honoured, so ?next= can't send anyone off-site. */
export function safeNext(value: string | null, fallback = "/account") {
  // "//host" and "/\host" are both treated as off-site by browsers.
  return value && value.startsWith("/") && !/^\/[/\\]/.test(value) ? value : fallback;
}
