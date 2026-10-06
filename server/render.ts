import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Assets } from "../src/document.js";
import type { RenderResult } from "../src/entry.server.js";
import { DEFAULT_LOCALE } from "../src/i18n/config.js";
import type { ApiFetch, ServerContext } from "../src/lib/api.js";
import { DEV_STYLESHEETS } from "./assets.js";
import { serverEnv } from "./env.js";

export type RenderFn = (
  request: Request,
  serverContext: ServerContext,
) => Promise<Response | RenderResult>;

/** Statuses that must not carry a body — `new Response` throws if given one. */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/**
 * In-process API access for loaders during SSR. `app.inject` runs the request
 * through Fastify's full pipeline (validation, hooks) without opening a socket,
 * and the visitor's cookies are forwarded so per-user endpoints behave as they
 * would from the browser.
 */
function createApiFetch(app: FastifyInstance, request: FastifyRequest): ApiFetch {
  return async (path, init = {}) => {
    if (!path.startsWith("/api/")) throw new Error(`apiFetch only reaches /api/*, got ${path}`);

    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (request.headers.cookie) headers.cookie = request.headers.cookie;

    const response = await app.inject({
      method: (init.method ?? "GET") as "GET",
      url: path,
      headers,
      ...(typeof init.body === "string" ? { payload: init.body } : {}),
    });

    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(response.headers)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        responseHeaders.append(key, String(item));
      }
    }
    const body = NULL_BODY_STATUSES.has(response.statusCode)
      ? null
      : new Uint8Array(response.rawPayload);
    return new Response(body, { status: response.statusCode, headers: responseHeaders });
  };
}

/** Build a WHATWG Request from the Fastify request, preserving method, headers and body. */
function toWebRequest(request: FastifyRequest, origin: string): Request {
  const url = new URL(request.url, origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return new Request(url, {
    method: request.method,
    headers,
    ...(hasBody ? { body: request.raw as unknown as BodyInit, duplex: "half" } : {}),
  } as RequestInit);
}

/**
 * The DOM and node:stream/web both declare `ReadableStream`, and TypeScript
 * treats them as unrelated types. They are the same object at runtime.
 */
function toNodeStream(stream: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>);
}

export async function sendRendered(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  render: RenderFn,
  assets: Assets,
) {
  const origin = `${request.protocol}://${request.host}`;
  const webRequest = toWebRequest(request, origin);

  // Set by @fastify/helmet's enableCSPNonces (production only).
  const nonce = (reply as FastifyReply & { cspNonce?: { script: string } }).cspNonce?.script;

  const env = serverEnv();
  const result = await render(webRequest, {
    shell: {
      assets,
      locale: DEFAULT_LOCALE,
      nonce,
      siteUrl: env.SITE_URL,
      // Uploads are served by this app at /media unless a CDN origin is configured.
      mediaUrl: env.MEDIA_URL ?? "/media",
      analytics:
        env.ANALYTICS_SCRIPT_URL && env.ANALYTICS_WEBSITE_ID
          ? { scriptUrl: env.ANALYTICS_SCRIPT_URL, websiteId: env.ANALYTICS_WEBSITE_ID }
          : null,
    },
    apiFetch: createApiFetch(app, request),
  });

  // Redirect produced by a loader or action.
  if (result instanceof Response) {
    reply.status(result.status);
    result.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(result.body ? toNodeStream(result.body) : null);
  }

  reply.status(result.status);
  result.headers.forEach((value, key) => reply.header(key, value));

  const stream = assets.dev
    ? injectBeforeHeadEnd(
        result.stream,
        DEV_STYLESHEETS.map(
          (href) => `<link rel="stylesheet" href="${href}" data-dev-ssr-css>`,
        ).join(""),
      )
    : result.stream;
  return reply.send(toNodeStream(stream));
}

/**
 * Inserts markup just before `</head>`. Used in dev only, to add the stylesheet
 * links outside React's tree: React 19 skips unexpected tags in <head> during
 * hydration, and the client can remove them later without touching React state.
 */
function injectBeforeHeadEnd(
  stream: ReadableStream<Uint8Array>,
  markup: string,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = "";
  let injected = false;

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        // Keep everything going through the decoder so a multi-byte character
        // split across chunks is never cut in half.
        const text = decoder.decode(chunk, { stream: true });
        if (injected) {
          controller.enqueue(encoder.encode(text));
          return;
        }
        pending += text;
        const end = pending.indexOf("</head>");
        if (end === -1) return;
        controller.enqueue(encoder.encode(pending.slice(0, end) + markup + pending.slice(end)));
        pending = "";
        injected = true;
      },
      flush(controller) {
        const rest = pending + decoder.decode();
        if (rest) controller.enqueue(encoder.encode(rest));
      },
    }),
  );
}
