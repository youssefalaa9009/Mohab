import { Suspense, useEffect, useState, type ReactNode } from "react";
import {
  Outlet,
  isRouteErrorResponse,
  useLocation,
  useRouteError,
  useRouteLoaderData,
  type LoaderFunctionArgs,
} from "react-router";
import { AnnouncementBar } from "./components/layout/AnnouncementBar";
import { Footer } from "./components/layout/Footer";
import { CheckoutHeader, Header } from "./components/layout/Header";
import { PageTransition, ScrollManager } from "./components/layout/ScrollManager";
import { BackToTop } from "./components/layout/BackToTop";
import { ErrorScene } from "./features/errors/ErrorScene";
import { buttonClassName } from "./components/ui/Button";
import { MotionProvider } from "./components/motion/MotionProvider";
import { Document, type Assets } from "./document";
import { CartProvider, useCart } from "./features/cart/CartProvider";
import { WishlistProvider } from "./features/wishlist/WishlistProvider";
import type { CartView } from "./features/cart/types";
import type { NavData } from "./features/catalog/types";
import { DEFAULT_LOCALE, directionOf, type Locale } from "./i18n/config";
import { apiGet, type ServerContext } from "./lib/api";
import { lazyOnDemand } from "./lib/lazy-on-demand";

/** Per-request data the server provides for the document shell. */
export type ShellData = {
  assets: Assets;
  locale: Locale;
  /** Per-request CSP nonce, applied to every script this document emits. */
  nonce?: string | undefined;
  /** Public origin, for canonical URLs and structured data. */
  siteUrl: string;
  /** Public base URL of uploaded media; null until storage is configured. */
  mediaUrl: string | null;
  /** Cookieless analytics; null (no script at all) unless configured. */
  analytics: { scriptUrl: string; websiteId: string } | null;
};

export type RootData = ShellData & {
  /** Null when the catalog is unreachable — the shell still renders. */
  nav: NavData | null;
  /** The visitor's bag at page load; the client keeps it current afterwards. */
  cart: CartView | null;
};

/**
 * Runs on the server only: in the browser the result arrives in the hydration
 * payload and `shouldRevalidate` keeps it from ever re-running.
 */
export async function rootLoader(args: LoaderFunctionArgs): Promise<RootData> {
  const { shell } = args.context as unknown as ServerContext;
  // Navigation is built from the live catalog, so links only exist for real
  // categories. A catalog outage must not take the whole site down with it.
  const [nav, cart] = await Promise.all([
    apiGet<NavData>(args, "/api/catalog/nav").catch(() => null),
    apiGet<CartView>(args, "/api/cart").catch(() => null),
  ]);
  return { ...shell, nav, cart };
}

/** Shell data is fixed for the lifetime of the page — never refetch it. */
export const rootShouldRevalidate = () => false;

export function useRootData() {
  return useRouteLoaderData("root") as RootData;
}

const cartDrawer = lazyOnDemand(() =>
  import("./features/cart/CartDrawer").then((module) => ({ default: module.CartDrawer })),
);

/** The drawer loads on demand: mounted the first time the bag opens, then kept for its animations. */
function LazyCartDrawer() {
  const { drawerOpen } = useCart();
  const [mounted, setMounted] = useState(false);
  cartDrawer.usePrefetch();
  if (drawerOpen && !mounted) setMounted(true);
  return mounted ? (
    <Suspense fallback={null}>
      <cartDrawer.Component />
    </Suspense>
  ) : null;
}

export function Root() {
  const data = useRootData();
  // Marks the page interactive — end-to-end tests wait on html[data-hydrated].
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return (
    <Document
      assets={data.assets}
      lang={data.locale}
      dir={directionOf(data.locale)}
      nonce={data.nonce}
      analytics={data.analytics}
    >
      <meta property="og:site_name" content="QUATTRO" />
      <MotionProvider>
        <CartProvider initial={data.cart}>
          <WishlistProvider>
            <div className="app-root flex min-h-dvh flex-col">
              <a
                href="#main"
                className="sr-only label-caps focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-100 focus:bg-ink focus:px-4 focus:py-3 focus:text-paper"
              >
                Skip to content
              </a>
              <Outlet />
            </div>
          </WishlistProvider>
        </CartProvider>
      </MotionProvider>
    </Document>
  );
}

/** Storefront chrome: header, footer and the bag drawer around every shop page. */
export function SiteLayout() {
  const data = useRootData();
  const { pathname } = useLocation();
  // The checkout form alone is distraction-free; the confirmation page gets the
  // full site back so the customer can keep shopping.
  const inCheckout = pathname === "/checkout";
  return (
    <>
      {inCheckout ? (
        <CheckoutHeader />
      ) : (
        <>
          <AnnouncementBar />
          {/* The homepage hero sits behind the header, so it starts transparent. */}
          <Header nav={data.nav} overHero={pathname === "/"} />
        </>
      )}
      <ScrollManager />
      <PageTransition>
        <Outlet />
      </PageTransition>
      <Footer nav={data.nav} minimal={inCheckout} />
      <BackToTop />
      <LazyCartDrawer />
    </>
  );
}

function errorCopy(error: unknown) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  if (status === 404) {
    return {
      status,
      title: "Page not found",
      message: "This page may have been moved, renamed or removed.",
    };
  }
  return {
    status,
    title: "Something went wrong",
    message: "We couldn’t load this page. Please try again in a moment.",
  };
}

function ErrorContent({ error, children }: { error: unknown; children?: ReactNode }) {
  const { status, title, message } = errorCopy(error);
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center px-gutter py-section text-center"
    >
      <title>{`${title} · QUATTRO`}</title>
      <meta name="robots" content="noindex" />
      <p className="label-caps text-muted">Error {status}</p>
      <h1 className="mt-4 font-display text-h1">{title}</h1>
      <p className="mt-4 max-w-[45ch] text-muted">{message}</p>
      {children}
    </main>
  );
}

/**
 * Page-level boundary. Lives on a layout route inside Root, so a failing page
 * keeps the header and footer and the visitor can navigate away.
 */
export function SiteErrorBoundary() {
  const error = useRouteError();
  if (import.meta.env.DEV && !isRouteErrorResponse(error)) console.error(error);
  const status = isRouteErrorResponse(error) ? error.status : 500;
  return (
    <ErrorScene
      status={status}
      action={
        status === 404 ? undefined : (
          // A full reload, so a transient failure gets a completely fresh attempt.
          <a href="" className={buttonClassName()}>
            Try again
          </a>
        )
      }
    />
  );
}

/**
 * Last-resort boundary. An error here replaced the whole tree, including the
 * document, so it must render one itself.
 */
export function RootErrorBoundary() {
  const error = useRouteError();
  const data = useRouteLoaderData("root") as RootData | undefined;
  if (import.meta.env.DEV && !isRouteErrorResponse(error)) console.error(error);

  const content = (
    <div className="app-root flex min-h-dvh flex-col">
      <ErrorContent error={error}>
        <a href="/" className="link-underline mt-10 label-caps">
          Return home
        </a>
      </ErrorContent>
    </div>
  );

  // When the root loader itself failed there is no asset data; render a bare document.
  if (!data) {
    return (
      <html lang={DEFAULT_LOCALE} dir="ltr">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>{content}</body>
      </html>
    );
  }

  return (
    <Document
      assets={data.assets}
      lang={data.locale}
      dir={directionOf(data.locale)}
      nonce={data.nonce}
    >
      {content}
    </Document>
  );
}
