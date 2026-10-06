import { useState, type FormEvent } from "react";
import { useLoaderData, useNavigate, type LoaderFunctionArgs } from "react-router";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/useHydrated";
import { PageHeader } from "./AdminLayout";
import { adminGet, adminPost } from "./api";
import type { AdminProductDetail } from "./types";

type Options = AdminProductDetail["options"];

export async function newProductLoader(args: LoaderFunctionArgs): Promise<Options> {
  return adminGet<Options>(args, "/api/admin/products/options");
}

/** Just enough to create a draft; everything else is edited on the product page. */
export function NewProductPage() {
  const options = useLoaderData() as Options;
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { id } = await adminPost<{ id: string }>("/api/admin/products", {
        name: data.get("name"),
        categoryId: data.get("categoryId"),
        gender: data.get("gender"),
      });
      navigate(`/admin/products/${id}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Couldn’t create the product.");
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="New product" />
      <form onSubmit={submit} method="post" className="flex max-w-lg flex-col gap-5">
        {error && (
          <p role="alert" className="border border-danger px-4 py-3 text-small text-danger">
            {error}
          </p>
        )}
        <label className="flex flex-col gap-2">
          <span className="label-caps text-muted">Name</span>
          <input
            name="name"
            required
            minLength={2}
            disabled={!hydrated}
            className="h-12 rounded-input border border-line-strong bg-surface px-4 focus:border-ink focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-caps text-muted">Category</span>
          <select
            name="categoryId"
            required
            disabled={!hydrated}
            className="h-12 rounded-input border border-line-strong bg-surface px-4"
          >
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="label-caps text-muted">For</span>
          <select
            name="gender"
            disabled={!hydrated}
            className="h-12 rounded-input border border-line-strong bg-surface px-4"
          >
            <option value="unisex">Everyone (unisex)</option>
            <option value="women">Women</option>
            <option value="men">Men</option>
          </select>
        </label>
        <p className="text-small text-muted">
          It’s created as a draft. Add colours, sizes, prices, stock and photos next, then publish.
        </p>
        <Button type="submit" loading={busy} disabled={!hydrated} className="self-start">
          Create draft
        </Button>
      </form>
    </>
  );
}
