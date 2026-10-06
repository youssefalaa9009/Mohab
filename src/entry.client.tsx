import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter, matchRoutes, type RouteObject } from "react-router";
import { routes } from "./routes";
import "./styles/globals.css";

declare global {
  interface Window {
    __staticRouterHydrationData?: unknown;
  }
}

/**
 * Resolve the `lazy()` modules for the routes matching the current URL *before*
 * hydrating. The server rendered real markup for these routes; if we hydrated
 * first, React Router would have no component for them yet and would render a
 * HydrateFallback, blanking the page until the chunk arrived.
 */
async function loadMatchedRoutes() {
  const matches = matchRoutes(routes, window.location) ?? [];
  await Promise.all(
    matches.map(async ({ route }) => {
      const lazyRoute = route as RouteObject;
      // `lazy` may also be an object of per-property loaders; ours are functions.
      if (typeof lazyRoute.lazy !== "function") return;
      const resolved = await lazyRoute.lazy();
      Object.assign(lazyRoute, resolved);
      delete lazyRoute.lazy;
    }),
  );
}

/*
 * Dev only: the server added <link> tags so the first paint is styled. The CSS
 * import above has now injected Vite's own <style>, which is the copy that hot
 * reloads, so remove the links before they go stale and override edits.
 */
if (import.meta.env.DEV) {
  document.querySelectorAll("link[data-dev-ssr-css]").forEach((link) => link.remove());
}

await loadMatchedRoutes();

const router = createBrowserRouter(routes, {
  hydrationData: window.__staticRouterHydrationData as never,
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
