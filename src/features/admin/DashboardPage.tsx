import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { buttonClassName } from "@/components/ui/Button";
import { PageHeader } from "./AdminLayout";
import { adminGet } from "./api";
import { egp } from "./format";
import type { AdminDashboard } from "./types";

export async function dashboardLoader(args: LoaderFunctionArgs) {
  return adminGet<AdminDashboard>(args, "/api/admin/dashboard");
}

export function DashboardPage() {
  const data = useLoaderData() as AdminDashboard;
  return (
    <>
      <PageHeader title="Dashboard" />

      {data.awaitingConfirmation > 0 && (
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border border-warning bg-surface px-6 py-5">
          <div>
            <p className="font-display text-h3">
              {data.awaitingConfirmation}{" "}
              {data.awaitingConfirmation === 1 ? "order is" : "orders are"} waiting for a
              confirmation call
            </p>
            <p className="mt-1 text-small text-muted">Oldest first — they’ve waited longest.</p>
          </div>
          <Link to="/admin/orders?status=awaiting_confirmation" className={buttonClassName()}>
            Start calling
          </Link>
        </div>
      )}

      {data.paymentsToVerify > 0 && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border border-ink bg-surface p-6">
          <p>
            <span className="font-display text-h3">{data.paymentsToVerify}</span> InstaPay{" "}
            {data.paymentsToVerify === 1 ? "transfer" : "transfers"} to verify
          </p>
          <Link to="/admin/orders?status=pending_payment" className={buttonClassName()}>
            Review payments
          </Link>
        </div>
      )}

      <dl className="grid gap-px bg-line sm:grid-cols-3">
        <Stat label="Awaiting confirmation" value={String(data.awaitingConfirmation)} />
        <Stat label="Orders today" value={String(data.ordersToday)} />
        <Stat
          label="Confirmed revenue, last 7 days"
          value={egp(data.week.revenue, data.week.currency)}
          hint={`${data.week.orders} ${data.week.orders === 1 ? "order" : "orders"}`}
        />
      </dl>

      <section className="mt-12" aria-labelledby="low-stock">
        <h2 id="low-stock" className="mb-4 label-caps">
          Low stock (3 or fewer)
        </h2>
        {data.lowStock.length === 0 ? (
          <p className="text-small text-muted">Nothing is running low.</p>
        ) : (
          <table className="w-full border-collapse text-small">
            <thead>
              <tr className="border-b border-ink text-start">
                <th scope="col" className="py-2 pe-4 text-start label-caps">
                  Product
                </th>
                <th scope="col" className="py-2 pe-4 text-start label-caps">
                  Variant
                </th>
                <th scope="col" className="py-2 pe-4 text-start label-caps">
                  SKU
                </th>
                <th scope="col" className="py-2 text-end label-caps">
                  In stock
                </th>
              </tr>
            </thead>
            <tbody>
              {data.lowStock.map((row) => (
                <tr key={row.variantId} className="border-b border-line">
                  <td className="py-3 pe-4">
                    <Link to={`/admin/products/${row.productId}`} className="hover:underline">
                      {row.productName}
                    </Link>
                  </td>
                  <td className="py-3 pe-4 text-muted">
                    {[row.colorName, row.size].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="py-3 pe-4 font-mono text-caption">{row.sku}</td>
                  <td
                    className={`py-3 text-end tabular-nums ${row.stock === 0 ? "text-danger" : "text-warning"}`}
                  >
                    {row.stock === 0 ? "Sold out" : row.stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface px-6 py-6">
      <dt className="label-caps text-muted">{label}</dt>
      <dd className="mt-3 font-display text-h2 tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-caption text-muted">{hint}</dd>}
    </div>
  );
}
