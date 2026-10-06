import type { RouteObject } from "react-router";

/**
 * Staff area. Lives beside the storefront under the root route, with its own
 * layout (no shop header/footer). The layout loader checks the session, so
 * every page below it is protected; the API enforces the same check again.
 */
export const adminRoutes: RouteObject[] = [
  {
    path: "admin/login",
    lazy: async () => {
      const { AdminLoginPage } = await import("./LoginPage");
      return { Component: AdminLoginPage };
    },
  },
  {
    id: "admin",
    path: "admin",
    lazy: async () => {
      const { AdminLayout, adminLayoutLoader, AdminErrorBoundary } = await import("./AdminLayout");
      return {
        Component: AdminLayout,
        loader: adminLayoutLoader,
        ErrorBoundary: AdminErrorBoundary,
      };
    },
    children: [
      {
        lazy: async () => {
          const { AdminErrorBoundary } = await import("./AdminLayout");
          return { ErrorBoundary: AdminErrorBoundary };
        },
        children: [
          {
            index: true,
            lazy: async () => {
              const { DashboardPage, dashboardLoader } = await import("./DashboardPage");
              return { Component: DashboardPage, loader: dashboardLoader };
            },
          },
          {
            path: "orders",
            lazy: async () => {
              const { OrdersPage, ordersLoader } = await import("./OrdersPage");
              return { Component: OrdersPage, loader: ordersLoader };
            },
          },
          {
            path: "orders/:number",
            lazy: async () => {
              const { OrderPage, orderLoader } = await import("./OrderPage");
              return { Component: OrderPage, loader: orderLoader };
            },
          },
          {
            path: "products",
            lazy: async () => {
              const { ProductsPage, productsLoader } = await import("./ProductsPage");
              return { Component: ProductsPage, loader: productsLoader };
            },
          },
          {
            path: "products/new",
            lazy: async () => {
              const { NewProductPage, newProductLoader } = await import("./NewProductPage");
              return { Component: NewProductPage, loader: newProductLoader };
            },
          },
          {
            path: "products/:id",
            lazy: async () => {
              const { ProductEditPage, productEditLoader } = await import("./ProductEditPage");
              return { Component: ProductEditPage, loader: productEditLoader };
            },
          },
          {
            path: "discounts",
            lazy: async () => {
              const { DiscountsPage, discountsLoader } = await import("./SettingsPages");
              return { Component: DiscountsPage, loader: discountsLoader };
            },
          },
          {
            path: "delivery",
            lazy: async () => {
              const { DeliveryPage, deliveryLoader } = await import("./SettingsPages");
              return { Component: DeliveryPage, loader: deliveryLoader };
            },
          },
          {
            path: "catalog",
            lazy: async () => {
              const { CatalogSettingsPage, catalogSettingsLoader } =
                await import("./SettingsPages");
              return { Component: CatalogSettingsPage, loader: catalogSettingsLoader };
            },
          },
          {
            path: "customers",
            lazy: async () => {
              const { CustomersPage, customersLoader } = await import("./SettingsPages");
              return { Component: CustomersPage, loader: customersLoader };
            },
          },
          {
            path: "payments",
            lazy: async () => {
              const { PaymentsPage, paymentsLoader } = await import("./PaymentsPage");
              return { Component: PaymentsPage, loader: paymentsLoader };
            },
          },
          {
            path: "messages",
            lazy: async () => {
              const { MessagesPage, messagesLoader } = await import("./ContentPages");
              return { Component: MessagesPage, loader: messagesLoader };
            },
          },
          {
            path: "newsletter",
            lazy: async () => {
              const { SubscribersPage, subscribersLoader } = await import("./ContentPages");
              return { Component: SubscribersPage, loader: subscribersLoader };
            },
          },
          {
            path: "*",
            loader: () => {
              throw new Response("Not found", { status: 404 });
            },
          },
        ],
      },
    ],
  },
];
