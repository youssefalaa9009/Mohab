import type { RouteObject } from "react-router";
// Type-only: erased at build time, so the shop module stays in its own lazy chunk.
import type { ShopKind } from "./features/catalog/shop/ShopPage";
import { adminRoutes } from "./features/admin/routes";
import {
  Root,
  RootErrorBoundary,
  SiteErrorBoundary,
  SiteLayout,
  rootLoader,
  rootShouldRevalidate,
} from "./root";

/** Matching this route means nothing else did; the server replies with 404. */
export const NOT_FOUND_ROUTE_ID = "not-found";

/** Listing pages share one module; each route fixes a different scope. */
function shopRoute(path: string, kind: ShopKind): RouteObject {
  return {
    path,
    lazy: async () => {
      const { ShopPage, shopLoader } = await import("./features/catalog/shop/ShopPage");
      return { Component: ShopPage, loader: shopLoader(kind) };
    },
  };
}

/**
 * Shared route table — the server renders it through `createStaticHandler`,
 * the browser through `createBrowserRouter`.
 *
 * Route modules are lazily imported so each page becomes its own chunk.
 * Loaders must stay isomorphic: they reach the Fastify API through
 * `src/lib/api.ts` and never import anything from `server/`.
 */
export const routes: RouteObject[] = [
  {
    id: "root",
    Component: Root,
    loader: rootLoader,
    shouldRevalidate: rootShouldRevalidate,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        // Storefront chrome. The error boundary sits one level in, so a failing
        // page renders inside the layout and keeps the header and footer.
        id: "site",
        Component: SiteLayout,
        children: [
          {
            id: "pages",
            ErrorBoundary: SiteErrorBoundary,
            children: [
              {
                index: true,
                lazy: async () => {
                  const { HomePage, homeLoader } = await import("./features/home/HomePage");
                  return { Component: HomePage, loader: homeLoader };
                },
              },
              shopRoute("shop", "all"),
              shopRoute("shop/:category", "category"),
              shopRoute("men", "men"),
              shopRoute("women", "women"),
              shopRoute("new-arrivals", "new"),
              shopRoute("collections/:slug", "collection"),
              {
                path: "collections",
                lazy: async () => {
                  const { CollectionsPage, collectionsLoader } =
                    await import("./features/catalog/collections/CollectionsPage");
                  return { Component: CollectionsPage, loader: collectionsLoader };
                },
              },
              {
                path: "products/:slug",
                lazy: async () => {
                  const { ProductPage, productLoader, productShouldRevalidate } =
                    await import("./features/catalog/product/ProductPage");
                  return {
                    Component: ProductPage,
                    loader: productLoader,
                    shouldRevalidate: productShouldRevalidate,
                  };
                },
              },
              {
                path: "account/login",
                lazy: async () => {
                  const { LoginPage } = await import("./features/account/AuthPages");
                  return { Component: LoginPage };
                },
              },
              {
                path: "account/register",
                lazy: async () => {
                  const { RegisterPage } = await import("./features/account/AuthPages");
                  return { Component: RegisterPage };
                },
              },
              {
                path: "account/forgot-password",
                lazy: async () => {
                  const { ForgotPasswordPage } = await import("./features/account/AuthPages");
                  return { Component: ForgotPasswordPage };
                },
              },
              {
                path: "account/reset-password",
                lazy: async () => {
                  const { ResetPasswordPage } = await import("./features/account/AuthPages");
                  return { Component: ResetPasswordPage };
                },
              },
              {
                id: "account",
                path: "account",
                lazy: async () => {
                  const { AccountLayout, accountLayoutLoader } =
                    await import("./features/account/AccountPages");
                  return { Component: AccountLayout, loader: accountLayoutLoader };
                },
                children: [
                  {
                    index: true,
                    lazy: async () => {
                      const { OverviewPage, ordersLoader } =
                        await import("./features/account/AccountPages");
                      return { Component: OverviewPage, loader: ordersLoader };
                    },
                  },
                  {
                    path: "orders",
                    lazy: async () => {
                      const { OrdersPage, ordersLoader } =
                        await import("./features/account/AccountPages");
                      return { Component: OrdersPage, loader: ordersLoader };
                    },
                  },
                  {
                    path: "orders/:number",
                    lazy: async () => {
                      const { OrderPage, orderLoader } =
                        await import("./features/account/AccountPages");
                      return { Component: OrderPage, loader: orderLoader };
                    },
                  },
                  {
                    path: "addresses",
                    lazy: async () => {
                      const { AddressesPage, addressesLoader } =
                        await import("./features/account/AccountPages");
                      return { Component: AddressesPage, loader: addressesLoader };
                    },
                  },
                  {
                    path: "settings",
                    lazy: async () => {
                      const { SettingsPage } = await import("./features/account/AccountPages");
                      return { Component: SettingsPage };
                    },
                  },
                ],
              },
              {
                path: "search",
                lazy: async () => {
                  const { SearchPage, searchLoader } = await import("./features/search/SearchPage");
                  return { Component: SearchPage, loader: searchLoader };
                },
              },
              {
                path: "about",
                lazy: async () => {
                  const { AboutPage } = await import("./features/content/ContentPages");
                  return { Component: AboutPage };
                },
              },
              {
                path: "contact",
                lazy: async () => {
                  const { ContactPage } = await import("./features/content/ContactPage");
                  return { Component: ContactPage };
                },
              },
              {
                path: "faq",
                lazy: async () => {
                  const { FaqPage } = await import("./features/content/ContentPages");
                  return { Component: FaqPage };
                },
              },
              {
                path: "help/shipping",
                lazy: async () => {
                  const { ShippingPage } = await import("./features/content/ContentPages");
                  return { Component: ShippingPage };
                },
              },
              {
                path: "help/returns",
                lazy: async () => {
                  const { ReturnsPage } = await import("./features/content/ContentPages");
                  return { Component: ReturnsPage };
                },
              },
              {
                path: "help/track-order",
                lazy: async () => {
                  const { TrackOrderPage } = await import("./features/content/TrackOrderPage");
                  return { Component: TrackOrderPage };
                },
              },
              {
                path: "legal/privacy",
                lazy: async () => {
                  const { PrivacyPage } = await import("./features/content/ContentPages");
                  return { Component: PrivacyPage };
                },
              },
              {
                path: "legal/terms",
                lazy: async () => {
                  const { TermsPage } = await import("./features/content/ContentPages");
                  return { Component: TermsPage };
                },
              },
              {
                path: "legal/cookies",
                lazy: async () => {
                  const { CookiesPage } = await import("./features/content/ContentPages");
                  return { Component: CookiesPage };
                },
              },
              {
                path: "newsletter/unsubscribe",
                lazy: async () => {
                  const { UnsubscribePage } = await import("./features/content/UnsubscribePage");
                  return { Component: UnsubscribePage };
                },
              },
              {
                path: "wishlist",
                lazy: async () => {
                  const { WishlistPage } = await import("./features/wishlist/WishlistPage");
                  return { Component: WishlistPage };
                },
              },
              {
                path: "cart",
                lazy: async () => {
                  const { CartPage } = await import("./features/cart/CartPage");
                  return { Component: CartPage };
                },
              },
              {
                path: "checkout",
                lazy: async () => {
                  const { CheckoutPage, checkoutLoader } =
                    await import("./features/checkout/CheckoutPage");
                  return { Component: CheckoutPage, loader: checkoutLoader };
                },
              },
              {
                path: "checkout/confirmation/:number",
                lazy: async () => {
                  const { ConfirmationPage, confirmationLoader } =
                    await import("./features/checkout/ConfirmationPage");
                  return { Component: ConfirmationPage, loader: confirmationLoader };
                },
              },
              {
                path: "design",
                lazy: async () => {
                  const { DesignSystemPage } = await import("./features/design/DesignSystemPage");
                  return { Component: DesignSystemPage };
                },
              },
              {
                // entry.server maps this id to an HTTP 404 — a soft 404 would let
                // search engines index missing pages.
                id: NOT_FOUND_ROUTE_ID,
                path: "*",
                lazy: async () => {
                  const { NotFoundPage } = await import("./features/errors/NotFoundPage");
                  return { Component: NotFoundPage };
                },
              },
            ],
          },
        ],
      },
      ...adminRoutes,
    ],
  },
];
