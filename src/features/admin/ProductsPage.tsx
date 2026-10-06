import { Plus, Search } from "lucide-react";
import { Form, Link, useLoaderData, useSearchParams, type LoaderFunctionArgs } from "react-router";
import { buttonClassName } from "@/components/ui/Button";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { toQuery } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PageHeader } from "./AdminLayout";
import { adminGet } from "./api";
import { egp, formatDate } from "./format";
import type { AdminProductList, ProductStatus } from "./types";

export async function productsLoader(args: LoaderFunctionArgs) {
  const params = new URL(args.request.url).searchParams;
  return adminGet<AdminProductList>(
    args,
    `/api/admin/products${toQuery({
      q: params.get("q") ?? undefined,
      status: params.get("status") ?? undefined,
      page: params.get("page") ?? undefined,
    })}`,
  );
}

const STATUS_STYLE: Record<ProductStatus, string> = {
  active: "border-success text-success",
  draft: "border-warning text-warning",
  archived: "border-line-strong text-muted",
};

export function ProductsPage() {
  const data = useLoaderData() as AdminProductList;
  const [params] = useSearchParams();

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          <Link to="/admin/products/new" className={buttonClassName()}>
            <Plus aria-hidden className="size-4" /> New product
          </Link>
        }
      />

      <Form method="get" role="search" className="mb-6 flex flex-wrap gap-2">
        <label className="relative min-w-60 flex-1 sm:max-w-sm">
          <span className="sr-only">Search products</span>
          <Search
            aria-hidden
            className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <input
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Name or SKU"
            className="h-11 w-full rounded-input border border-line-strong bg-surface ps-9 pe-3 text-small focus:border-ink focus:outline-none"
          />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select
            name="status"
            defaultValue={params.get("status") ?? ""}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="h-11 rounded-input border border-line-strong bg-surface px-3 text-small"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </Form>

      {data.products.length === 0 ? (
        <p className="border border-line px-6 py-16 text-center text-muted">No products found.</p>
      ) : (
        <div role="region" aria-label="Products" tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-small">
            <thead>
              <tr className="border-b border-ink">
                <th scope="col" className="py-2 pe-4 text-start label-caps">
                  Product
                </th>
                <th scope="col" className="py-2 pe-4 text-start label-caps">
                  Status
                </th>
                <th scope="col" className="py-2 pe-4 text-end label-caps">
                  Price
                </th>
                <th scope="col" className="py-2 pe-4 text-end label-caps">
                  In stock
                </th>
                <th scope="col" className="py-2 text-end label-caps">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((product) => (
                <tr key={product.id} className="border-b border-line hover:bg-surface">
                  <td className="py-3 pe-4">
                    <Link to={`/admin/products/${product.id}`} className="flex items-center gap-3">
                      <span className="block w-10 shrink-0">
                        <span className="block aspect-[4/5]">
                          <ProductImage image={product.image} decorative sizes="3rem" />
                        </span>
                      </span>
                      <span>
                        <span className="hover:underline">{product.name}</span>
                        <span className="block text-caption text-muted">
                          {product.categoryName} · {product.variantCount} variants
                          {product.isDemo && " · demo"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 pe-4">
                    <span
                      className={cn(
                        "inline-flex h-6 items-center border px-2 label-caps",
                        STATUS_STYLE[product.status],
                      )}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="py-3 pe-4 text-end whitespace-nowrap tabular-nums">
                    {product.minPrice === null
                      ? "—"
                      : product.minPrice === product.maxPrice
                        ? egp(product.minPrice)
                        : `${egp(product.minPrice)} – ${egp(product.maxPrice!)}`}
                  </td>
                  <td
                    className={cn(
                      "py-3 pe-4 text-end tabular-nums",
                      product.totalStock === 0 && "text-danger",
                    )}
                  >
                    {product.totalStock}
                  </td>
                  <td className="py-3 text-end whitespace-nowrap text-muted">
                    {formatDate(product.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.pageCount > 1 && (
        <p className="mt-6 text-small text-muted">
          Page {data.page} of {data.pageCount}
          {data.page < data.pageCount && (
            <Link
              className="ms-4 underline"
              to={`?${new URLSearchParams({ ...Object.fromEntries(params), page: String(data.page + 1) })}`}
            >
              Next page
            </Link>
          )}
        </p>
      )}
    </>
  );
}
