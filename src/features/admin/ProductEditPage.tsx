import { ExternalLink, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLoaderData, useRevalidator, type LoaderFunctionArgs } from "react-router";
import { Button } from "@/components/ui/Button";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import { adminGet, adminPost } from "./api";
import { formatDateTime } from "./format";
import type { AdminProductDetail, AdminVariant, StockMovement } from "./types";

export async function productEditLoader(args: LoaderFunctionArgs) {
  return adminGet<AdminProductDetail>(
    args,
    `/api/admin/products/${encodeURIComponent(args.params.id!)}`,
  );
}

const field =
  "h-11 w-full rounded-input border border-line-strong bg-canvas px-3 text-small focus:border-ink focus:outline-none disabled:opacity-60";
const area =
  "w-full rounded-input border border-line-strong bg-canvas px-3 py-2 text-small focus:border-ink focus:outline-none disabled:opacity-60";

/** Each section saves on its own and reports its own errors. */
function useAction() {
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const run = async (request: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await request();
      await revalidator.revalidate();
      setSaved(true);
      return true;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, saved, run };
}

export function ProductEditPage() {
  const product = useLoaderData() as AdminProductDetail;
  const base = `/api/admin/products/${product.id}`;
  return (
    <>
      <title>{`${product.name} · Admin · QUATTRO`}</title>
      <Link to="/admin/products" className="link-underline label-caps text-muted">
        ← Products
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-h1">{product.name}</h1>
        <span
          className={cn(
            "inline-flex h-6 items-center border px-2 label-caps",
            product.status === "active"
              ? "border-success text-success"
              : product.status === "draft"
                ? "border-warning text-warning"
                : "border-line-strong text-muted",
          )}
        >
          {product.status}
        </span>
        {product.status === "active" && (
          <Link
            to={`/products/${product.slug}`}
            target="_blank"
            className="flex items-center gap-1 text-small text-muted hover:text-ink"
          >
            View on store <ExternalLink aria-hidden className="size-3.5" />
          </Link>
        )}
      </div>
      {product.isDemo && (
        <p className="mb-8 border border-warning bg-surface px-4 py-3 text-small">
          Demo product — removed by <code>npm run db:seed -- --clean</code> before launch.
        </p>
      )}

      <div className="flex flex-col gap-10">
        <DetailsSection product={product} base={base} />
        <ColorsSection product={product} base={base} />
        <VariantsSection product={product} base={base} />
        <ImagesSection product={product} base={base} />
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-surface p-6">
      <h2 className="label-caps">{title}</h2>
      {description && <p className="mt-1 text-small text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Feedback({ error, saved }: { error: string | null; saved: boolean }) {
  if (error) {
    return (
      <p role="alert" className="text-small text-danger">
        {error}
      </p>
    );
  }
  return saved ? (
    <p role="status" className="text-small text-success">
      Saved.
    </p>
  ) : null;
}

function Labeled({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="label-caps text-muted">{label}</span>
      {children}
    </label>
  );
}

/* ─── Details ─────────────────────────────────────────────────────────────── */

function DetailsSection({ product, base }: { product: AdminProductDetail; base: string }) {
  const { busy, error, saved, run } = useAction();
  const hydrated = useHydrated();
  const disabled = !hydrated || busy;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "");
    void run(() =>
      adminPost(
        base,
        {
          name: value("name"),
          slug: value("slug"),
          categoryId: value("categoryId"),
          gender: value("gender"),
          status: value("status"),
          isFeatured: data.get("isFeatured") === "on",
          merchRank: Number(value("merchRank") || 0),
          sizeChartId: value("sizeChartId") || null,
          collectionIds: data.getAll("collectionIds").map(String),
          description: value("description"),
          material: value("material"),
          fit: value("fit"),
          care: value("care"),
          tags: value("tags")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          seoTitle: value("seoTitle"),
          seoDescription: value("seoDescription"),
        },
        "PUT",
      ),
    );
  };

  return (
    <Section title="Details">
      <form onSubmit={submit} method="post" className="grid gap-5 md:grid-cols-2">
        <Labeled label="Name">
          <input
            name="name"
            defaultValue={product.name}
            required
            className={field}
            disabled={disabled}
          />
        </Labeled>
        <Labeled label="URL slug">
          <input
            name="slug"
            defaultValue={product.slug}
            pattern="[a-z0-9\-]+"
            className={field}
            disabled={disabled}
          />
        </Labeled>
        <Labeled label="Category">
          <select
            name="categoryId"
            defaultValue={product.categoryId}
            className={field}
            disabled={disabled}
          >
            {product.options.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="For">
          <select name="gender" defaultValue={product.gender} className={field} disabled={disabled}>
            <option value="unisex">Everyone (unisex)</option>
            <option value="women">Women</option>
            <option value="men">Men</option>
          </select>
        </Labeled>
        <Labeled label="Status">
          <select name="status" defaultValue={product.status} className={field} disabled={disabled}>
            <option value="draft">Draft — hidden from the store</option>
            <option value="active">Active — on sale</option>
            <option value="archived">Archived — retired</option>
          </select>
        </Labeled>
        <Labeled label="Size chart">
          <select
            name="sizeChartId"
            defaultValue={product.sizeChartId ?? ""}
            className={field}
            disabled={disabled}
          >
            <option value="">None</option>
            {product.options.sizeCharts.map((chart) => (
              <option key={chart.id} value={chart.id}>
                {chart.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Featured order (higher shows first)">
          <input
            name="merchRank"
            type="number"
            min={0}
            defaultValue={product.merchRank}
            className={field}
            disabled={disabled}
          />
        </Labeled>
        <label className="flex items-center gap-3 self-end pb-3 text-small">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={product.isFeatured}
            disabled={disabled}
            className="size-4 accent-ink"
          />
          Feature on the homepage
        </label>

        {product.options.collections.length > 0 && (
          <fieldset className="md:col-span-2">
            <legend className="label-caps text-muted">Collections</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {product.options.collections.map((collection) => (
                <label key={collection.id} className="flex items-center gap-2 text-small">
                  <input
                    type="checkbox"
                    name="collectionIds"
                    value={collection.id}
                    defaultChecked={product.collectionIds.includes(collection.id)}
                    disabled={disabled}
                    className="size-4 accent-ink"
                  />
                  {collection.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Labeled label="Description" className="md:col-span-2">
          <textarea
            name="description"
            rows={5}
            defaultValue={product.description ?? ""}
            className={area}
            disabled={disabled}
          />
        </Labeled>
        <Labeled label="Material">
          <input
            name="material"
            defaultValue={product.material ?? ""}
            className={field}
            disabled={disabled}
          />
        </Labeled>
        <Labeled label="Fit">
          <input
            name="fit"
            defaultValue={product.fit ?? ""}
            className={field}
            disabled={disabled}
          />
        </Labeled>
        <Labeled label="Care instructions" className="md:col-span-2">
          <textarea
            name="care"
            rows={2}
            defaultValue={product.care ?? ""}
            className={area}
            disabled={disabled}
          />
        </Labeled>
        <Labeled label="Tags (comma separated)" className="md:col-span-2">
          <input
            name="tags"
            defaultValue={product.tags.join(", ")}
            className={field}
            disabled={disabled}
          />
        </Labeled>
        <Labeled label="Search title (optional, 70 characters)">
          <input
            name="seoTitle"
            maxLength={70}
            defaultValue={product.seoTitle ?? ""}
            className={field}
            disabled={disabled}
          />
        </Labeled>
        <Labeled label="Search description (optional, 170 characters)">
          <input
            name="seoDescription"
            maxLength={170}
            defaultValue={product.seoDescription ?? ""}
            className={field}
            disabled={disabled}
          />
        </Labeled>

        <div className="flex items-center gap-4 md:col-span-2">
          <Button type="submit" loading={busy} disabled={!hydrated}>
            Save details
          </Button>
          <Feedback error={error} saved={saved} />
        </div>
      </form>
    </Section>
  );
}

/* ─── Colours ─────────────────────────────────────────────────────────────── */

function ColorsSection({ product, base }: { product: AdminProductDetail; base: string }) {
  const { busy, error, run } = useAction();
  const hydrated = useHydrated();
  const disabled = !hydrated || busy;

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(() =>
      adminPost(`${base}/colors`, { name: data.get("name"), hex: data.get("hex") }),
    ).then((ok) => ok && form.reset());
  };

  return (
    <Section
      title="Colours"
      description="Add colours before generating variants or uploading photos for them."
    >
      {product.colors.length > 0 && (
        <ul className="mb-5 flex flex-wrap gap-2">
          {product.colors.map((color) => (
            <li
              key={color.id}
              className="flex items-center gap-2 border border-line-strong bg-canvas py-1.5 ps-3 pe-1"
            >
              <span
                aria-hidden
                className="size-4 rounded-full border border-line-strong"
                style={{ backgroundColor: color.hex ?? "transparent" }}
              />
              <span className="text-small">{color.name}</span>
              <button
                type="button"
                aria-label={`Delete ${color.name}`}
                disabled={disabled}
                onClick={() =>
                  window.confirm(`Delete the colour ${color.name}?`) &&
                  void run(() => adminPost(`${base}/colors/${color.id}`, {}, "DELETE"))
                }
                className="inline-flex size-8 items-center justify-center text-muted hover:text-danger"
              >
                <Trash2 aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} method="post" className="flex flex-wrap items-end gap-3">
        <Labeled label="Colour name">
          <input
            name="name"
            required
            placeholder="e.g. Ink"
            className={cn(field, "w-48")}
            disabled={disabled}
          />
        </Labeled>
        <Labeled label="Swatch">
          <input
            name="hex"
            type="color"
            defaultValue="#111110"
            className="h-11 w-16 cursor-pointer border border-line-strong bg-canvas"
            disabled={disabled}
          />
        </Labeled>
        <Button type="submit" variant="secondary" loading={busy} disabled={!hydrated}>
          Add colour
        </Button>
      </form>
      <div className="mt-3">
        <Feedback error={error} saved={false} />
      </div>
    </Section>
  );
}

/* ─── Variants & stock ────────────────────────────────────────────────────── */

function VariantsSection({ product, base }: { product: AdminProductDetail; base: string }) {
  const colorName = (id: string | null) =>
    product.colors.find((color) => color.id === id)?.name ?? "—";
  return (
    <Section
      title="Variants, prices & stock"
      description="Prices in EGP. Stock changes are recorded with a reason, so every number can be traced."
    >
      {product.variants.length === 0 ? (
        <p className="mb-6 text-small text-muted">No variants yet — generate them below.</p>
      ) : (
        <div className="mb-8 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-small">
            <thead>
              <tr className="border-b border-ink">
                {["Variant", "SKU", "Price", "Compare at", "Active", "Stock", ""].map(
                  (heading, index) => (
                    <th key={index} scope="col" className="py-2 pe-3 text-start label-caps">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <VariantRow
                  key={variant.id}
                  variant={variant}
                  label={[
                    variant.colorId ? colorName(variant.colorId) : null,
                    variant.size ?? "One size",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  base={base}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <GenerateVariants product={product} base={base} />
    </Section>
  );
}

function VariantRow({
  variant,
  label,
  base,
}: {
  variant: AdminVariant;
  label: string;
  base: string;
}) {
  const save = useAction();
  const stock = useAction();
  const hydrated = useHydrated();
  const [adjusting, setAdjusting] = useState(false);
  const [history, setHistory] = useState<StockMovement[] | null>(null);
  const formId = `variant-${variant.id}`;

  const submitRow = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const compareAt = String(data.get("compareAtPrice") ?? "").trim();
    void save.run(() =>
      adminPost(
        `${base}/variants/${variant.id}`,
        {
          sku: data.get("sku"),
          price: Number(data.get("price")),
          compareAtPrice: compareAt === "" ? null : Number(compareAt),
          isActive: data.get("isActive") === "on",
        },
        "PUT",
      ),
    );
  };

  const submitStock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void stock
      .run(() =>
        adminPost(`${base}/variants/${variant.id}/stock`, {
          mode: data.get("mode"),
          quantity: Number(data.get("quantity")),
          reason: data.get("reason"),
          note: data.get("note"),
        }),
      )
      .then((ok) => ok && setAdjusting(false));
  };

  const loadHistory = async () => {
    const response = await fetch(`${base}/variants/${variant.id}/history`, {
      credentials: "same-origin",
    });
    if (response.ok) setHistory((await response.json()) as StockMovement[]);
  };

  return (
    <>
      <tr className={cn("border-b border-line align-top", !variant.isActive && "opacity-60")}>
        <td className="py-3 pe-3">
          <form id={formId} onSubmit={submitRow} method="post" />
          {label}
        </td>
        <td className="py-2 pe-3">
          <input
            form={formId}
            name="sku"
            defaultValue={variant.sku}
            aria-label={`SKU for ${label}`}
            className={cn(field, "h-9 w-44 font-mono text-caption")}
            disabled={!hydrated}
          />
        </td>
        <td className="py-2 pe-3">
          <input
            form={formId}
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={variant.price / 100}
            aria-label={`Price for ${label}`}
            className={cn(field, "h-9 w-28")}
            disabled={!hydrated}
          />
        </td>
        <td className="py-2 pe-3">
          <input
            form={formId}
            name="compareAtPrice"
            type="number"
            min={0}
            step="0.01"
            defaultValue={variant.compareAtPrice === null ? "" : variant.compareAtPrice / 100}
            aria-label={`Compare-at price for ${label}`}
            placeholder="—"
            className={cn(field, "h-9 w-28")}
            disabled={!hydrated}
          />
        </td>
        <td className="py-3 pe-3">
          <input
            form={formId}
            name="isActive"
            type="checkbox"
            defaultChecked={variant.isActive}
            aria-label={`${label} active`}
            className="size-4 accent-ink"
            disabled={!hydrated}
          />
        </td>
        <td className={cn("py-3 pe-3 tabular-nums", variant.stock === 0 && "text-danger")}>
          {variant.stock}
          <button
            type="button"
            onClick={() => setAdjusting((value) => !value)}
            className="ms-3 underline"
            disabled={!hydrated}
          >
            Adjust
          </button>
          <button
            type="button"
            onClick={loadHistory}
            className="ms-3 text-muted underline"
            disabled={!hydrated}
          >
            History
          </button>
        </td>
        <td className="py-2">
          <Button
            type="submit"
            form={formId}
            variant="secondary"
            className="h-9 px-3"
            loading={save.busy}
            disabled={!hydrated}
          >
            Save
          </Button>
        </td>
      </tr>
      {(save.error || adjusting || history) && (
        <tr className="border-b border-line">
          <td colSpan={7} className="bg-canvas px-3 py-4">
            <Feedback error={save.error} saved={false} />
            {adjusting && (
              <form onSubmit={submitStock} method="post" className="flex flex-wrap items-end gap-3">
                <Labeled label="Change">
                  <select name="mode" className={cn(field, "h-9 w-40")}>
                    <option value="add">Add / remove</option>
                    <option value="set">Set exact count</option>
                  </select>
                </Labeled>
                <Labeled label="Quantity">
                  <input
                    name="quantity"
                    type="number"
                    required
                    defaultValue={0}
                    className={cn(field, "h-9 w-24")}
                  />
                </Labeled>
                <Labeled label="Reason">
                  <select name="reason" className={cn(field, "h-9 w-44")}>
                    <option value="restock">Restock (new delivery)</option>
                    <option value="adjustment">Adjustment (count, damage)</option>
                  </select>
                </Labeled>
                <Labeled label="Note">
                  <input name="note" placeholder="Optional" className={cn(field, "h-9 w-56")} />
                </Labeled>
                <Button type="submit" className="h-9 px-4" loading={stock.busy}>
                  Apply
                </Button>
                <Feedback error={stock.error} saved={false} />
              </form>
            )}
            {history && (
              <div className={cn(adjusting && "mt-4")}>
                <p className="mb-2 label-caps text-muted">Stock history</p>
                {history.length === 0 ? (
                  <p className="text-small text-muted">No movements yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-caption">
                    {history.map((movement, index) => (
                      <li key={index} className="flex flex-wrap gap-x-3">
                        <span
                          className={cn(
                            "w-12 tabular-nums",
                            movement.delta > 0 ? "text-success" : "text-danger",
                          )}
                        >
                          {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                        </span>
                        <span className="w-24">{movement.reason}</span>
                        <span className="text-muted">{formatDateTime(movement.createdAt)}</span>
                        <span className="text-muted">
                          {[movement.orderNumber, movement.actor, movement.note]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function GenerateVariants({ product, base }: { product: AdminProductDetail; base: string }) {
  const { busy, error, run } = useAction();
  const hydrated = useHydrated();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const colorIds = data
      .getAll("colorIds")
      .map((value) => (value === "none" ? null : String(value)));
    const sizesText = String(data.get("sizes") ?? "").trim();
    const sizes = sizesText
      ? sizesText
          .split(",")
          .map((size) => size.trim().toUpperCase())
          .filter(Boolean)
      : [null];
    void run(() =>
      adminPost(`${base}/variants`, {
        colorIds: colorIds.length ? colorIds : [null],
        sizes,
        price: Number(data.get("price")),
      }),
    );
  };

  return (
    <form onSubmit={submit} method="post" className="flex flex-col gap-4 border-t border-line pt-6">
      <p className="label-caps">Generate variants</p>
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="sr-only">Colours</legend>
        {product.colors.length === 0 ? (
          <p className="text-small text-muted">No colours yet — variants will have no colour.</p>
        ) : (
          product.colors.map((color) => (
            <label key={color.id} className="flex items-center gap-2 text-small">
              <input
                type="checkbox"
                name="colorIds"
                value={color.id}
                defaultChecked
                className="size-4 accent-ink"
              />
              {color.name}
            </label>
          ))
        )}
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <Labeled label="Sizes (comma separated, empty = one size)">
          <input name="sizes" placeholder="S, M, L, XL" className={cn(field, "w-72")} />
        </Labeled>
        <Labeled label="Price (EGP)">
          <input
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            className={cn(field, "w-32")}
          />
        </Labeled>
        <Button type="submit" variant="secondary" loading={busy} disabled={!hydrated}>
          Generate
        </Button>
      </div>
      <p className="text-caption text-muted">
        Only missing combinations are created. New variants start with 0 in stock.
      </p>
      <Feedback error={error} saved={false} />
    </form>
  );
}

/* ─── Photos ──────────────────────────────────────────────────────────────── */

function ImagesSection({ product, base }: { product: AdminProductDetail; base: string }) {
  const { busy, error, run } = useAction();
  const hydrated = useHydrated();

  const upload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(async () => {
      // Multipart: the browser sets the boundary, so no content-type header here.
      const response = await fetch(`${base}/images`, {
        method: "POST",
        credentials: "same-origin",
        body: data,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Upload failed.");
      }
    }).then((ok) => ok && form.reset());
  };

  return (
    <Section
      title="Photos"
      description="Use 4:5 portrait images, at least 1600 px wide. The first photo of a colour becomes its main image, the second its hover image."
    >
      {product.images.length > 0 && (
        <ul className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {product.images.map((image) => (
            <ImageCard key={image.id} image={image} product={product} base={base} />
          ))}
        </ul>
      )}
      <form
        onSubmit={upload}
        method="post"
        encType="multipart/form-data"
        className="flex flex-wrap items-end gap-3"
      >
        <Labeled label="Image file">
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
            className="text-small"
            disabled={!hydrated}
          />
        </Labeled>
        <Labeled label="Describe it (alt text)">
          <input
            name="alt"
            required
            minLength={3}
            placeholder="e.g. Front view, model wearing size M"
            className={cn(field, "w-80")}
            disabled={!hydrated}
          />
        </Labeled>
        <Labeled label="Colour">
          <select name="colorId" className={cn(field, "w-40")} disabled={!hydrated}>
            <option value="">All colours</option>
            {product.colors.map((color) => (
              <option key={color.id} value={color.id}>
                {color.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Button type="submit" variant="secondary" loading={busy} disabled={!hydrated}>
          Upload
        </Button>
      </form>
      <div className="mt-3">
        <Feedback error={error} saved={false} />
      </div>
    </Section>
  );
}

function ImageCard({
  image,
  product,
  base,
}: {
  image: AdminProductDetail["images"][number];
  product: AdminProductDetail;
  base: string;
}) {
  const { busy, error, run } = useAction();
  const hydrated = useHydrated();

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(() =>
      adminPost(
        `${base}/images/${image.id}`,
        {
          alt: data.get("alt"),
          role: data.get("role"),
          colorId: data.get("colorId") || null,
          position: Number(data.get("position")),
        },
        "PUT",
      ),
    );
  };

  return (
    <li className="flex flex-col gap-2 border border-line bg-canvas p-2">
      <div className="aspect-[4/5]">
        <ProductImage image={image} sizes="16rem" />
      </div>
      <form onSubmit={save} method="post" className="flex flex-col gap-2">
        <input
          name="alt"
          defaultValue={image.alt}
          aria-label="Alt text"
          className={cn(field, "h-9")}
          disabled={!hydrated}
        />
        <div className="flex gap-2">
          <select
            name="role"
            defaultValue={image.role}
            aria-label="Role"
            className={cn(field, "h-9")}
            disabled={!hydrated}
          >
            <option value="primary">Main</option>
            <option value="hover">Hover</option>
            <option value="gallery">Gallery</option>
          </select>
          <input
            name="position"
            type="number"
            min={0}
            defaultValue={image.position}
            aria-label="Order"
            className={cn(field, "h-9 w-16")}
            disabled={!hydrated}
          />
        </div>
        <select
          name="colorId"
          defaultValue={image.colorId ?? ""}
          aria-label="Colour"
          className={cn(field, "h-9")}
          disabled={!hydrated}
        >
          <option value="">All colours</option>
          {product.colors.map((color) => (
            <option key={color.id} value={color.id}>
              {color.name}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-between">
          <Button
            type="submit"
            variant="secondary"
            className="h-9 px-3"
            loading={busy}
            disabled={!hydrated}
          >
            Save
          </Button>
          <button
            type="button"
            aria-label="Delete image"
            disabled={!hydrated || busy}
            onClick={() =>
              window.confirm("Delete this photo?") &&
              void run(() => adminPost(`${base}/images/${image.id}`, {}, "DELETE"))
            }
            className="inline-flex size-9 items-center justify-center text-muted hover:text-danger"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
        <Feedback error={error} saved={false} />
      </form>
    </li>
  );
}
