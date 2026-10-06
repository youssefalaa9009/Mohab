import { renderToReadableStream } from "react-dom/server";
import { StaticRouterProvider, createStaticHandler, createStaticRouter } from "react-router";
import type { ServerContext } from "./lib/api";
import { NOT_FOUND_ROUTE_ID, routes } from "./routes";

const handler = createStaticHandler(routes);

export type RenderResult = {
  status: number;
  headers: Headers;
  stream: ReadableStream<Uint8Array>;
};

/**
 * Server-render a request. Returns either a Response (redirect produced by a
 * loader/action) or a streaming result for Fastify to pipe to the client.
 *
 * `serverContext` reaches every loader as `context`: the shell data (assets,
 * locale, nonce) for the root loader, and an in-process `apiFetch` for data.
 */
export async function render(
  request: Request,
  serverContext: ServerContext,
): Promise<Response | RenderResult> {
  const context = await handler.query(request, { requestContext: serverContext });
  const { nonce } = serverContext.shell;

  // A loader or action returned a redirect.
  if (context instanceof Response) return context;

  const router = createStaticRouter(handler.dataRoutes, context);

  let didError = false;
  const stream = await renderToReadableStream(
    // The nonce lets the hydration <script> pass CSP without 'unsafe-inline'.
    <StaticRouterProvider router={router} context={context} nonce={nonce} />,
    {
      nonce,
      onError(error) {
        // Errors after the shell are reported here; the shell itself rejects below.
        didError = true;
        console.error("[ssr]", error);
      },
    },
  );

  // Wait for the full tree so crawlers and the HTTP status always agree.
  // Switch to shell-first streaming per route once pages have Suspense boundaries.
  await stream.allReady;

  // A matched catch-all route still renders 200 by default; make it a real 404.
  const matchedNotFound = context.matches.some((match) => match.route.id === NOT_FOUND_ROUTE_ID);
  const status = matchedNotFound ? 404 : context.statusCode;

  return {
    status: didError ? 500 : status,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    stream,
  };
}
