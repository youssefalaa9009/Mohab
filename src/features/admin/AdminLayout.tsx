import {
  FolderTree,
  LayoutDashboard,
  LogOut,
  Mail,
  Newspaper,
  Package,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Link,
  NavLink,
  Outlet,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import { cn } from "@/lib/cn";
import { adminGet } from "./api";
import type { AdminOrderList, Viewer } from "./types";

type LayoutData = { viewer: Viewer; awaiting: number };

export async function adminLayoutLoader(args: LoaderFunctionArgs): Promise<LayoutData> {
  const [viewer, queue] = await Promise.all([
    adminGet<Viewer>(args, "/api/admin/me"),
    adminGet<AdminOrderList>(args, "/api/admin/orders?status=awaiting_confirmation"),
  ]);
  return { viewer, awaiting: queue.total };
}

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  {
    to: "/admin",
    label: "Dashboard",
    icon: <LayoutDashboard aria-hidden className="size-4" />,
    end: true,
  },
  { to: "/admin/orders", label: "Orders", icon: <ShoppingBag aria-hidden className="size-4" /> },
  { to: "/admin/products", label: "Products", icon: <Package aria-hidden className="size-4" /> },
  {
    to: "/admin/catalog",
    label: "Categories",
    icon: <FolderTree aria-hidden className="size-4" />,
  },
  { to: "/admin/discounts", label: "Discounts", icon: <Tag aria-hidden className="size-4" /> },
  { to: "/admin/delivery", label: "Delivery", icon: <Truck aria-hidden className="size-4" /> },
  {
    to: "/admin/payments",
    label: "Payments",
    icon: <Wallet aria-hidden className="size-4" />,
  },
  { to: "/admin/customers", label: "Customers", icon: <Users aria-hidden className="size-4" /> },
  { to: "/admin/messages", label: "Messages", icon: <Mail aria-hidden className="size-4" /> },
  {
    to: "/admin/newsletter",
    label: "Newsletter",
    icon: <Newspaper aria-hidden className="size-4" />,
  },
];

export function AdminLayout() {
  const { viewer, awaiting } = useLoaderData() as LayoutData;

  const signOut = async () => {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    window.location.assign("/admin/login");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <title>Admin · QUATTRO</title>
      <meta name="robots" content="noindex, nofollow" />

      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-e lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
          <Link to="/admin" className="font-display text-h3 tracking-[0.2em]">
            QUATTRO
          </Link>
          <p className="label-caps text-muted lg:mt-1">Admin</p>
        </div>
        <nav aria-label="Admin" className="overflow-x-auto">
          <ul className="flex gap-1 px-3 pb-3 lg:flex-col lg:pb-0">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 text-small whitespace-nowrap transition-colors",
                      isActive ? "bg-ink text-paper" : "hover:bg-line/60",
                    )
                  }
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/admin/orders" && awaiting > 0 && (
                    <span
                      className="rounded-full bg-warning px-2 text-caption text-paper tabular-nums"
                      title={`${awaiting} awaiting confirmation`}
                    >
                      {awaiting}
                      <span className="sr-only"> awaiting confirmation</span>
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden px-5 py-6 lg:absolute lg:bottom-0 lg:block lg:w-60">
          <p className="truncate text-small">{viewer.name}</p>
          <p className="truncate text-caption text-muted">{viewer.email}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link to="/" className="flex items-center gap-2 text-caption text-muted hover:text-ink">
              <Store aria-hidden className="size-3.5" /> View store
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 text-caption text-muted hover:text-ink"
            >
              <LogOut aria-hidden className="size-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1 px-5 py-8 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}

export function AdminErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message =
    status === 404
      ? "That page or record doesn’t exist."
      : status === 403
        ? "This account doesn’t have staff access."
        : "Something went wrong loading this page.";
  if (import.meta.env.DEV && !isRouteErrorResponse(error)) console.error(error);
  return (
    <div className="py-16">
      <p className="label-caps text-muted">Error {status}</p>
      <h1 className="mt-3 font-display text-h2">{message}</h1>
      <Link to="/admin" className="link-underline mt-8 inline-block label-caps">
        Back to dashboard
      </Link>
    </div>
  );
}

/** Small shared pieces for admin pages. */
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-display text-h1">{title}</h1>
      {actions}
    </div>
  );
}
