import { Search, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Form,
  Link,
  useLoaderData,
  useRevalidator,
  useSearchParams,
  type LoaderFunctionArgs,
} from "react-router";
import { Button } from "@/components/ui/Button";
import { GOVERNORATES } from "@/features/checkout/schema";
import { useHydrated } from "@/hooks/useHydrated";
import { toQuery } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PageHeader } from "./AdminLayout";
import { adminGet, adminPost } from "./api";
import { displayPhone, egp, formatDate, formatDateTime } from "./format";
import type { AdminCoupon, AdminCustomer, AdminShippingRate, AdminTaxonomyItem } from "./types";

const field =
  "h-10 w-full rounded-input border border-line-strong bg-canvas px-3 text-small focus:border-ink focus:outline-none disabled:opacity-60";

/** Run a mutation, then reload the page data. */
function useSave() {
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (request: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await request();
      await revalidator.revalidate();
      return true;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
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

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-small text-danger">
      {error}
    </p>
  ) : null;
}

const numberOrNull = (value: FormDataEntryValue | null) =>
  value === null || String(value).trim() === "" ? null : Number(value);
const dateOrNull = (value: FormDataEntryValue | null) =>
  value === null || String(value) === "" ? null : new Date(String(value)).toISOString();
/** ISO → value for <input type="datetime-local">, in local time. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/* ─── Discounts ───────────────────────────────────────────────────────────── */

export async function discountsLoader(args: LoaderFunctionArgs) {
  return adminGet<AdminCoupon[]>(args, "/api/admin/coupons");
}

function couponSummary(coupon: AdminCoupon) {
  if (coupon.type === "percent") return `${coupon.value}% off`;
  if (coupon.type === "fixed") return `${egp(coupon.value)} off`;
  return "Free delivery";
}

export function DiscountsPage() {
  const coupons = useLoaderData() as AdminCoupon[];
  const [editing, setEditing] = useState<AdminCoupon | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Discounts"
        actions={<Button onClick={() => setEditing("new")}>New code</Button>}
      />
      {editing && (
        <CouponForm
          key={editing === "new" ? "new" : editing.id}
          coupon={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      {coupons.length === 0 ? (
        <p className="border border-line px-6 py-16 text-center text-muted">
          No discount codes yet.
        </p>
      ) : (
        <div role="region" aria-label="Discount codes" tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-small">
            <thead>
              <tr className="border-b border-ink">
                {["Code", "Discount", "Conditions", "Used", "Status", ""].map((heading, index) => (
                  <th key={index} scope="col" className="py-2 pe-4 text-start label-caps">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const expired = coupon.endsAt !== null && new Date(coupon.endsAt) < new Date();
                return (
                  <tr key={coupon.id} className="border-b border-line">
                    <td className="py-3 pe-4 font-mono">{coupon.code}</td>
                    <td className="py-3 pe-4">{couponSummary(coupon)}</td>
                    <td className="py-3 pe-4 text-muted">
                      {[
                        coupon.minSubtotal !== null && `min ${egp(coupon.minSubtotal)}`,
                        coupon.endsAt && `until ${formatDate(coupon.endsAt)}`,
                        coupon.perCustomerLimit !== null &&
                          `${coupon.perCustomerLimit} per customer`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="py-3 pe-4 tabular-nums">
                      {coupon.timesUsed}
                      {coupon.usageLimit !== null && ` / ${coupon.usageLimit}`}
                    </td>
                    <td className="py-3 pe-4">
                      {!coupon.isActive ? "Off" : expired ? "Expired" : "Active"}
                    </td>
                    <td className="py-3 text-end">
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setEditing(coupon)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CouponForm({ coupon, onDone }: { coupon: AdminCoupon | null; onDone: () => void }) {
  const { busy, error, run } = useSave();
  const hydrated = useHydrated();
  const [type, setType] = useState<AdminCoupon["type"]>(coupon?.type ?? "percent");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      code: data.get("code"),
      type,
      value: type === "free_shipping" ? 0 : Number(data.get("value")),
      minSubtotal: numberOrNull(data.get("minSubtotal")),
      startsAt: dateOrNull(data.get("startsAt")),
      endsAt: dateOrNull(data.get("endsAt")),
      usageLimit: numberOrNull(data.get("usageLimit")),
      perCustomerLimit: numberOrNull(data.get("perCustomerLimit")),
      isActive: data.get("isActive") === "on",
    };
    void run(() =>
      coupon
        ? adminPost(`/api/admin/coupons/${coupon.id}`, body, "PUT")
        : adminPost("/api/admin/coupons", body),
    ).then((ok) => ok && onDone());
  };

  return (
    <form
      onSubmit={submit}
      method="post"
      className="mb-10 grid gap-4 border border-line bg-surface p-6 md:grid-cols-3"
    >
      <h2 className="label-caps md:col-span-3">
        {coupon ? `Edit ${coupon.code}` : "New discount code"}
      </h2>
      <Labeled label="Code">
        <input
          name="code"
          required
          defaultValue={coupon?.code ?? ""}
          className={cn(field, "uppercase")}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Type">
        <select
          value={type}
          onChange={(event) => setType(event.target.value as AdminCoupon["type"])}
          className={field}
          disabled={!hydrated}
        >
          <option value="percent">Percentage off</option>
          <option value="fixed">Amount off (EGP)</option>
          <option value="free_shipping">Free delivery</option>
        </select>
      </Labeled>
      {type !== "free_shipping" && (
        <Labeled label={type === "percent" ? "Percent" : "Amount (EGP)"}>
          <input
            name="value"
            type="number"
            required
            min={type === "percent" ? 1 : 1}
            max={type === "percent" ? 100 : undefined}
            step={type === "percent" ? 1 : "0.01"}
            defaultValue={
              coupon ? (coupon.type === "fixed" ? coupon.value / 100 : coupon.value) : ""
            }
            className={field}
            disabled={!hydrated}
          />
        </Labeled>
      )}
      <Labeled label="Minimum bag (EGP, optional)">
        <input
          name="minSubtotal"
          type="number"
          min={0}
          step="0.01"
          defaultValue={coupon?.minSubtotal != null ? coupon.minSubtotal / 100 : ""}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Starts (optional)">
        <input
          name="startsAt"
          type="datetime-local"
          defaultValue={toLocalInput(coupon?.startsAt ?? null)}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Ends (optional)">
        <input
          name="endsAt"
          type="datetime-local"
          defaultValue={toLocalInput(coupon?.endsAt ?? null)}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Total uses (optional)">
        <input
          name="usageLimit"
          type="number"
          min={1}
          defaultValue={coupon?.usageLimit ?? ""}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Uses per customer (optional)">
        <input
          name="perCustomerLimit"
          type="number"
          min={1}
          defaultValue={coupon?.perCustomerLimit ?? ""}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <label className="flex items-center gap-2 self-end pb-2 text-small">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={coupon?.isActive ?? true}
          className="size-4 accent-ink"
          disabled={!hydrated}
        />
        Active
      </label>
      <div className="flex items-center gap-3 md:col-span-3">
        <Button type="submit" loading={busy} disabled={!hydrated}>
          Save code
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <ErrorLine error={error} />
      </div>
    </form>
  );
}

/* ─── Delivery rates ──────────────────────────────────────────────────────── */

export async function deliveryLoader(args: LoaderFunctionArgs) {
  return adminGet<AdminShippingRate[]>(args, "/api/admin/shipping-rates");
}

export function DeliveryPage() {
  const rates = useLoaderData() as AdminShippingRate[];
  const hasDemo = rates.some((rate) => rate.name.startsWith("[DEMO]") && rate.isActive);
  return (
    <>
      <PageHeader title="Delivery" />
      <p className="mb-6 max-w-[64ch] text-small text-muted">
        A rate with no governorate applies everywhere. Region-specific rates are offered alongside
        it, so you can, for example, charge less within Cairo. Turn a rate off to stop offering it.
      </p>
      {hasDemo && (
        <p className="mb-6 border border-warning bg-surface px-4 py-3 text-small">
          The free <strong>[DEMO]</strong> delivery rate is still active. Add your real rates and
          switch it off before launch.
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {rates.map((rate) => (
          <li key={rate.id}>
            <RateForm rate={rate} />
          </li>
        ))}
        <li>
          <RateForm rate={null} />
        </li>
      </ul>
    </>
  );
}

function RateForm({ rate }: { rate: AdminShippingRate | null }) {
  const { busy, error, run } = useSave();
  const hydrated = useHydrated();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: data.get("name"),
      region: data.get("region") || null,
      price: Number(data.get("price")),
      freeOver: numberOrNull(data.get("freeOver")),
      etaMinDays: numberOrNull(data.get("etaMinDays")),
      etaMaxDays: numberOrNull(data.get("etaMaxDays")),
      isActive: data.get("isActive") === "on",
      position: Number(data.get("position") ?? 0),
    };
    void run(() =>
      rate
        ? adminPost(`/api/admin/shipping-rates/${rate.id}`, body, "PUT")
        : adminPost("/api/admin/shipping-rates", body),
    ).then((ok) => ok && !rate && form.reset());
  };

  return (
    <form
      onSubmit={submit}
      method="post"
      className={cn(
        "grid gap-3 border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1fr_0.7fr_0.7fr_0.6fr_auto]",
        rate ? "border-line" : "border-dashed border-line-strong",
        rate && !rate.isActive && "opacity-60",
      )}
    >
      <Labeled label={rate ? "Name" : "New rate — name"}>
        <input
          name="name"
          required
          defaultValue={rate?.name ?? ""}
          placeholder="Standard delivery"
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Governorate">
        <select
          name="region"
          defaultValue={rate?.region ?? ""}
          className={field}
          disabled={!hydrated}
        >
          <option value="">All of Egypt</option>
          {GOVERNORATES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Labeled>
      <Labeled label="Price (EGP)">
        <input
          name="price"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={rate ? rate.price / 100 : ""}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Free over (EGP)">
        <input
          name="freeOver"
          type="number"
          min={0}
          step="0.01"
          defaultValue={rate?.freeOver != null ? rate.freeOver / 100 : ""}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Min days">
        <input
          name="etaMinDays"
          type="number"
          min={0}
          defaultValue={rate?.etaMinDays ?? ""}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Max days">
        <input
          name="etaMaxDays"
          type="number"
          min={0}
          defaultValue={rate?.etaMaxDays ?? ""}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Order">
        <input
          name="position"
          type="number"
          min={0}
          defaultValue={rate?.position ?? 0}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <div className="flex items-end gap-3">
        <label className="flex h-10 items-center gap-2 text-small">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={rate?.isActive ?? true}
            className="size-4 accent-ink"
            disabled={!hydrated}
          />
          On
        </label>
        <Button
          type="submit"
          variant={rate ? "secondary" : "primary"}
          className="h-10 px-4"
          loading={busy}
          disabled={!hydrated}
        >
          {rate ? "Save" : "Add"}
        </Button>
      </div>
      {error && (
        <div className="sm:col-span-2 lg:col-span-8">
          <ErrorLine error={error} />
        </div>
      )}
    </form>
  );
}

/* ─── Categories & collections ────────────────────────────────────────────── */

type CatalogData = { categories: AdminTaxonomyItem[]; collections: AdminTaxonomyItem[] };

export async function catalogSettingsLoader(args: LoaderFunctionArgs) {
  return adminGet<CatalogData>(args, "/api/admin/catalog");
}

export function CatalogSettingsPage() {
  const data = useLoaderData() as CatalogData;
  return (
    <>
      <PageHeader title="Categories & collections" />
      <div className="grid gap-12 xl:grid-cols-2">
        <TaxonomyList
          kind="categories"
          title="Categories"
          hint="The shop’s sections (/shop/…). Only categories with live products appear in the navigation."
          items={data.categories}
        />
        <TaxonomyList
          kind="collections"
          title="Collections"
          hint="Curated drops (/collections/…). Optional dates make one appear and disappear on schedule."
          items={data.collections}
        />
      </div>
    </>
  );
}

function TaxonomyList({
  kind,
  title,
  hint,
  items,
}: {
  kind: "categories" | "collections";
  title: string;
  hint: string;
  items: AdminTaxonomyItem[];
}) {
  return (
    <section aria-labelledby={`${kind}-heading`}>
      <h2 id={`${kind}-heading`} className="label-caps">
        {title}
      </h2>
      <p className="mt-1 mb-5 text-small text-muted">{hint}</p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <TaxonomyForm kind={kind} item={item} />
          </li>
        ))}
        <li>
          <TaxonomyForm kind={kind} item={null} />
        </li>
      </ul>
    </section>
  );
}

function TaxonomyForm({
  kind,
  item,
}: {
  kind: "categories" | "collections";
  item: AdminTaxonomyItem | null;
}) {
  const { busy, error, run } = useSave();
  const hydrated = useHydrated();
  const scheduled = kind === "collections";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: data.get("name"),
      slug: data.get("slug") || undefined,
      description: data.get("description"),
      isActive: data.get("isActive") === "on",
      position: Number(data.get("position") ?? 0),
      ...(scheduled
        ? { startsAt: dateOrNull(data.get("startsAt")), endsAt: dateOrNull(data.get("endsAt")) }
        : {}),
    };
    void run(() =>
      item
        ? adminPost(`/api/admin/${kind}/${item.id}`, body, "PUT")
        : adminPost(`/api/admin/${kind}`, body),
    ).then((ok) => ok && !item && form.reset());
  };

  return (
    <form
      onSubmit={submit}
      method="post"
      className={cn(
        "grid gap-3 border bg-surface p-4 sm:grid-cols-[2fr_1.5fr_0.6fr]",
        item ? "border-line" : "border-dashed border-line-strong",
        item && !item.isActive && "opacity-60",
      )}
    >
      <Labeled label={item ? `Name · ${item.productCount} products` : "New — name"}>
        <input
          name="name"
          required
          defaultValue={item?.name ?? ""}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="URL slug">
        <input
          name="slug"
          defaultValue={item?.slug ?? ""}
          placeholder="from name"
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Order">
        <input
          name="position"
          type="number"
          min={0}
          defaultValue={item?.position ?? 0}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      <Labeled label="Description (optional)" className="sm:col-span-3">
        <input
          name="description"
          defaultValue={item?.description ?? ""}
          className={field}
          disabled={!hydrated}
        />
      </Labeled>
      {scheduled && (
        <>
          <Labeled label="Starts (optional)">
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={toLocalInput(item?.startsAt ?? null)}
              className={field}
              disabled={!hydrated}
            />
          </Labeled>
          <Labeled label="Ends (optional)" className="sm:col-span-2">
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={toLocalInput(item?.endsAt ?? null)}
              className={field}
              disabled={!hydrated}
            />
          </Labeled>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <label className="flex items-center gap-2 text-small">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={item?.isActive ?? true}
            className="size-4 accent-ink"
            disabled={!hydrated}
          />
          Visible
        </label>
        <Button
          type="submit"
          variant={item ? "secondary" : "primary"}
          className="h-10 px-4"
          loading={busy}
          disabled={!hydrated}
        >
          {item ? "Save" : "Add"}
        </Button>
        {item && (
          <button
            type="button"
            aria-label={`Delete ${item.name}`}
            disabled={!hydrated || busy}
            onClick={() =>
              window.confirm(`Delete ${item.name}?`) &&
              void run(() => adminPost(`/api/admin/${kind}/${item.id}`, {}, "DELETE"))
            }
            className="ms-auto inline-flex size-10 items-center justify-center text-muted hover:text-danger"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
        <ErrorLine error={error} />
      </div>
    </form>
  );
}

/* ─── Customers ───────────────────────────────────────────────────────────── */

export async function customersLoader(args: LoaderFunctionArgs) {
  const q = new URL(args.request.url).searchParams.get("q") ?? undefined;
  return adminGet<AdminCustomer[]>(args, `/api/admin/customers${toQuery({ q })}`);
}

export function CustomersPage() {
  const customers = useLoaderData() as AdminCustomer[];
  const [params] = useSearchParams();
  return (
    <>
      <PageHeader title="Customers" />
      <p className="mb-6 max-w-[64ch] text-small text-muted">
        Customers are grouped by the phone number they order with — most cash-on-delivery shoppers
        don’t create an account. Spend counts confirmed orders only.
      </p>
      <Form method="get" role="search" className="mb-6 max-w-md">
        <label className="relative block">
          <span className="sr-only">Search customers</span>
          <Search
            aria-hidden
            className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <input
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Name, phone or email"
            className="h-11 w-full rounded-input border border-line-strong bg-surface ps-9 pe-3 text-small focus:border-ink focus:outline-none"
          />
        </label>
      </Form>
      {customers.length === 0 ? (
        <p className="border border-line px-6 py-16 text-center text-muted">No customers yet.</p>
      ) : (
        <div role="region" aria-label="Customers" tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-small">
            <thead>
              <tr className="border-b border-ink">
                {["Customer", "Orders", "Spent", "Cancelled", "Last order"].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className={cn(
                      "py-2 pe-4 label-caps",
                      heading === "Customer" ? "text-start" : "text-end",
                    )}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.phone} className="border-b border-line hover:bg-surface">
                  <td className="py-3 pe-4">
                    <Link
                      to={`/admin/orders?q=${encodeURIComponent(customer.phone.slice(-9))}`}
                      className="hover:underline"
                    >
                      {customer.name}
                    </Link>
                    <span className="block text-caption text-muted tabular-nums">
                      {displayPhone(customer.phone)}
                      {customer.email && ` · ${customer.email}`}
                    </span>
                  </td>
                  <td className="py-3 pe-4 text-end tabular-nums">{customer.orders}</td>
                  <td className="py-3 pe-4 text-end tabular-nums">{egp(customer.spent)}</td>
                  <td
                    className={cn(
                      "py-3 pe-4 text-end tabular-nums",
                      customer.cancelled > 0 && "text-warning",
                    )}
                  >
                    {customer.cancelled}
                  </td>
                  <td className="py-3 text-end whitespace-nowrap text-muted">
                    {formatDateTime(customer.lastOrderAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
