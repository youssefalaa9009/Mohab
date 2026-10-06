import { Search } from "lucide-react";
import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
  type LoaderFunctionArgs,
} from "react-router";
import { buttonClassName } from "@/components/ui/Button";
import { toQuery } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PageHeader } from "./AdminLayout";
import { adminGet } from "./api";
import { displayPhone, egp, formatDateTime } from "./format";
import { StatusBadge } from "./StatusBadge";
import { STATUS_LABELS, type AdminOrderList, type OrderStatus } from "./types";

export async function ordersLoader(args: LoaderFunctionArgs) {
  const params = new URL(args.request.url).searchParams;
  return adminGet<AdminOrderList>(
    args,
    `/api/admin/orders${toQuery({
      status: params.get("status") ?? undefined,
      q: params.get("q") ?? undefined,
      page: params.get("page") ?? undefined,
    })}`,
  );
}

/** The tabs staff actually work through, in order. */
const TABS: (OrderStatus | "all")[] = [
  "awaiting_confirmation",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "all",
];

export function OrdersPage() {
  const data = useLoaderData() as AdminOrderList;
  const [params] = useSearchParams();
  const navigation = useNavigation();
  const active = (params.get("status") as OrderStatus | null) ?? "all";
  const allCount = Object.values(data.counts).reduce((sum, value) => sum + (value ?? 0), 0);

  const tabHref = (tab: OrderStatus | "all") => {
    const next = new URLSearchParams(params);
    if (tab === "all") next.delete("status");
    else next.set("status", tab);
    next.delete("page");
    return `?${next}`;
  };

  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          // A plain download link: the browser sends the session cookie.
          <a
            href={`/api/admin/orders.csv${toQuery({
              status: params.get("status") ?? undefined,
              q: params.get("q") ?? undefined,
            })}`}
            download
            className={buttonClassName({ variant: "secondary" })}
          >
            Export CSV
          </a>
        }
      />

      <nav aria-label="Order status" className="-mx-5 mb-6 overflow-x-auto px-5 lg:mx-0 lg:px-0">
        <ul className="flex gap-1 border-b border-line">
          {TABS.map((tab) => {
            const count = tab === "all" ? allCount : (data.counts[tab] ?? 0);
            const current = tab === active;
            return (
              <li key={tab}>
                <Link
                  to={tabHref(tab)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-small whitespace-nowrap",
                    current ? "border-ink" : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {tab === "all" ? "All" : STATUS_LABELS[tab]}
                  <span className="text-caption tabular-nums">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Form method="get" role="search" className="mb-6 flex max-w-md gap-2">
        {active !== "all" && <input type="hidden" name="status" value={active} />}
        <label className="relative flex-1">
          <span className="sr-only">Search orders</span>
          <Search
            aria-hidden
            className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <input
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Order number, name or phone"
            className="h-11 w-full rounded-input border border-line-strong bg-surface ps-9 pe-3 text-small focus:border-ink focus:outline-none"
          />
        </label>
      </Form>

      {data.orders.length === 0 ? (
        <p className="border border-line px-6 py-16 text-center text-muted">
          {params.get("q") ? "No orders match that search." : "No orders here."}
        </p>
      ) : (
        <div
          className={cn(
            "overflow-x-auto transition-opacity",
            navigation.state === "loading" && "opacity-50",
          )}
        >
          <table className="w-full min-w-[48rem] border-collapse text-small">
            <thead>
              <tr className="border-b border-ink">
                {["Order", "Placed", "Customer", "Governorate", "Items", "Total", "Status"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={cn(
                        "py-2 pe-4 label-caps",
                        heading === "Total" || heading === "Items" ? "text-end" : "text-start",
                      )}
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order) => (
                <tr key={order.number} className="border-b border-line hover:bg-surface">
                  <td className="py-3 pe-4">
                    <Link
                      to={`/admin/orders/${order.number}`}
                      className="font-medium hover:underline"
                    >
                      {order.number}
                    </Link>
                  </td>
                  <td className="py-3 pe-4 whitespace-nowrap text-muted">
                    {formatDateTime(order.placedAt)}
                  </td>
                  <td className="py-3 pe-4">
                    {order.name}
                    <span className="block text-caption text-muted tabular-nums">
                      {displayPhone(order.phone)}
                    </span>
                  </td>
                  <td className="py-3 pe-4 text-muted">{order.region}</td>
                  <td className="py-3 pe-4 text-end tabular-nums">{order.itemCount}</td>
                  <td className="py-3 pe-4 text-end tabular-nums">
                    {egp(order.total, order.currency)}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={order.status} />
                    {order.status === "awaiting_confirmation" && order.attempts > 0 && (
                      <span className="ms-2 text-caption text-muted">
                        {order.attempts} {order.attempts === 1 ? "call" : "calls"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center gap-4 text-small">
          {data.page > 1 && (
            <Link
              to={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(data.page - 1) })}`}
            >
              ← Previous
            </Link>
          )}
          <span className="text-muted">
            Page {data.page} of {data.pageCount}
          </span>
          {data.page < data.pageCount && (
            <Link
              to={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(data.page + 1) })}`}
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
