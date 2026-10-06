import { useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLoaderData,
  useRevalidator,
  useRouteLoaderData,
  type LoaderFunctionArgs,
} from "react-router";
import { Button } from "@/components/ui/Button";
import { STATUS_LABELS, type OrderStatus } from "@/features/admin/types";
import { GOVERNORATES, type OrderSummary } from "@/features/checkout/schema";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { Meta } from "@/lib/seo";
import { InstapayPanel } from "@/features/orders/InstapayPanel";
import { OrderDetails } from "@/features/orders/OrderDetails";
import { accountGet, RequestError, send, type FieldErrors } from "./api";
import { TextInput } from "./AuthPages";

export type Me = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  marketingOptIn: boolean;
  role: "customer" | "admin";
};

type OrderRow = {
  number: string;
  status: OrderStatus;
  placedAt: string;
  total: number;
  currency: string;
};

export type Address = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  governorate: string;
  city: string;
  line1: string;
  line2: string | null;
  isDefault: boolean;
};

const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium" });
const egp = (amount: number, currency = "EGP") => formatMoney({ amount, currency });
const localPhone = (e164: string | null) =>
  e164?.startsWith("+20") ? `0${e164.slice(3)}` : (e164 ?? "");

/* ─── Layout ──────────────────────────────────────────────────────────────── */

export async function accountLayoutLoader(args: LoaderFunctionArgs) {
  return accountGet<Me>(args, "/api/account/me");
}

const useMe = () => useRouteLoaderData("account") as Me;

export function AccountLayout() {
  const me = useLoaderData() as Me;
  const hydrated = useHydrated();
  const signOut = async () => {
    await send("/api/auth/sign-out", {}).catch(() => {});
    window.location.assign("/");
  };
  const tabs = [
    { to: "/account", label: "Overview", end: true },
    { to: "/account/orders", label: "Orders" },
    { to: "/account/addresses", label: "Addresses" },
    { to: "/account/settings", label: "Settings" },
  ];

  return (
    <main id="main" className="container-page flex-1 pt-10 pb-section lg:pt-14">
      <Meta title="Your account" noindex />
      <p className="label-caps text-muted">Your account</p>
      <h1 className="mt-3 font-display text-h1">Hello, {me.name.split(" ")[0]}</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Account" className="lg:border-e lg:border-line lg:pe-6">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {tabs.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      "block px-3 py-2.5 text-small whitespace-nowrap",
                      isActive ? "bg-ink text-paper" : "hover:bg-line/60",
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
            {me.role === "admin" && (
              <li>
                <Link
                  to="/admin"
                  className="block px-3 py-2.5 text-small whitespace-nowrap hover:bg-line/60"
                >
                  Store admin
                </Link>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={signOut}
                disabled={!hydrated}
                className="block w-full px-3 py-2.5 text-start text-small whitespace-nowrap text-muted hover:text-ink"
              >
                Sign out
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </main>
  );
}

/* ─── Overview & orders ───────────────────────────────────────────────────── */

export async function ordersLoader(args: LoaderFunctionArgs) {
  return accountGet<OrderRow[]>(args, "/api/account/orders");
}

function OrderList({ orders }: { orders: OrderRow[] }) {
  if (!orders.length) {
    return (
      <p className="border border-line px-6 py-12 text-center text-muted">
        No orders yet.{" "}
        <Link to="/shop" className="text-ink underline">
          Start shopping
        </Link>
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {orders.map((order) => (
        <li key={order.number}>
          <Link
            to={`/account/orders/${order.number}`}
            className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-surface"
          >
            <span>
              <span className="font-medium">{order.number}</span>
              <span className="ms-3 text-small text-muted">
                {date.format(new Date(order.placedAt))}
              </span>
            </span>
            <span className="flex items-center gap-4">
              <span className="label-caps text-muted">{STATUS_LABELS[order.status]}</span>
              <span className="tabular-nums">{egp(order.total, order.currency)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OverviewPage() {
  const orders = useLoaderData() as OrderRow[];
  const me = useMe();
  return (
    <div className="flex flex-col gap-12">
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="label-caps">Recent orders</h2>
          {orders.length > 3 && (
            <Link to="/account/orders" className="link-underline label-caps">
              All orders
            </Link>
          )}
        </div>
        <OrderList orders={orders.slice(0, 3)} />
      </section>
      <section>
        <h2 className="mb-4 label-caps">Details</h2>
        <p>{me.name}</p>
        <p className="text-muted">{me.email}</p>
        {me.phone && <p className="text-muted tabular-nums">{localPhone(me.phone)}</p>}
        <Link to="/account/settings" className="link-underline mt-4 inline-block label-caps">
          Edit details
        </Link>
      </section>
    </div>
  );
}

export function OrdersPage() {
  const orders = useLoaderData() as OrderRow[];
  return (
    <section>
      <h2 className="mb-4 label-caps">Orders</h2>
      <OrderList orders={orders} />
    </section>
  );
}

export async function orderLoader(args: LoaderFunctionArgs) {
  return accountGet<OrderSummary>(
    args,
    `/api/account/orders/${encodeURIComponent(args.params.number!)}`,
  );
}

export function OrderPage() {
  const order = useLoaderData() as OrderSummary;
  const revalidator = useRevalidator();
  return (
    <section>
      <Link to="/account/orders" className="link-underline label-caps text-muted">
        ← Orders
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline gap-4">
        <h2 className="font-display text-h2">{order.number}</h2>
        <span className="label-caps text-muted">{STATUS_LABELS[order.status as OrderStatus]}</span>
      </div>
      <p className="mt-2 text-small text-muted">
        Placed {date.format(new Date(order.placedAt))} ·{" "}
        {order.paymentMethod === "instapay" ? "InstaPay" : "Cash on delivery"}
      </p>
      {order.instapay && (
        <div className="mt-8">
          <InstapayPanel
            order={order}
            submitPath={`/api/account/orders/${encodeURIComponent(order.number)}/instapay`}
            onUpdated={() => void revalidator.revalidate()}
          />
        </div>
      )}
      <OrderDetails order={order} />
    </section>
  );
}

/* ─── Addresses ───────────────────────────────────────────────────────────── */

export async function addressesLoader(args: LoaderFunctionArgs) {
  return accountGet<Address[]>(args, "/api/account/addresses");
}

export function AddressesPage() {
  const addresses = useLoaderData() as Address[];
  const [editing, setEditing] = useState<Address | "new" | null>(addresses.length ? null : "new");
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="label-caps">Addresses</h2>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="link-underline label-caps"
          >
            Add address
          </button>
        )}
      </div>
      {editing && (
        <AddressForm
          key={editing === "new" ? "new" : editing.id}
          address={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {addresses.map((address) => (
          <li key={address.id} className="border border-line bg-surface p-5 text-small">
            <p className="flex items-center justify-between gap-2">
              <span className="font-medium">{address.label ?? address.fullName}</span>
              {address.isDefault && <span className="label-caps text-muted">Default</span>}
            </p>
            <address className="mt-2 text-muted not-italic">
              {address.fullName}
              <br />
              {address.line1}
              {address.line2 && (
                <>
                  <br />
                  {address.line2}
                </>
              )}
              <br />
              {address.city}, {address.governorate}
              <br />
              <span className="tabular-nums">{localPhone(address.phone)}</span>
            </address>
            <div className="mt-4 flex gap-4">
              <button type="button" onClick={() => setEditing(address)} className="underline">
                Edit
              </button>
              <DeleteAddress id={address.id} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeleteAddress({ id }: { id: string }) {
  const revalidator = useRevalidator();
  return (
    <button
      type="button"
      className="text-muted underline hover:text-danger"
      onClick={async () => {
        if (!window.confirm("Delete this address?")) return;
        await send(`/api/account/addresses/${id}`, {}, "DELETE").catch(() => {});
        await revalidator.revalidate();
      }}
    >
      Delete
    </button>
  );
}

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const revalidator = useRevalidator();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      label: data.get("label"),
      fullName: data.get("fullName"),
      phone: data.get("phone"),
      governorate: data.get("governorate"),
      city: data.get("city"),
      line1: data.get("line1"),
      line2: data.get("line2"),
      isDefault: data.get("isDefault") === "on",
    };
    setBusy(true);
    setError(null);
    try {
      await (address
        ? send(`/api/account/addresses/${address.id}`, body, "PUT")
        : send("/api/account/addresses", body));
      await revalidator.revalidate();
      onDone();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Couldn’t save the address.");
      if (problem instanceof RequestError) setFields(problem.fields);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      method="post"
      noValidate
      className="grid gap-4 border border-line bg-surface p-6 md:grid-cols-2"
    >
      {error && (
        <p role="alert" className="text-small text-danger md:col-span-2">
          {error}
        </p>
      )}
      <TextInput
        name="fullName"
        label="Full name"
        autoComplete="name"
        defaultValue={address?.fullName}
        error={fields.fullName}
        disabled={!hydrated}
      />
      <TextInput
        name="phone"
        label="Mobile number"
        type="tel"
        autoComplete="tel"
        defaultValue={localPhone(address?.phone ?? null)}
        error={fields.phone}
        disabled={!hydrated}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="governorate" className="label-caps text-muted">
          Governorate
        </label>
        <select
          id="governorate"
          name="governorate"
          autoComplete="address-level1"
          defaultValue={address?.governorate ?? ""}
          disabled={!hydrated}
          className="h-12 rounded-input border border-line-strong bg-surface px-4"
        >
          <option value="" disabled>
            Select…
          </option>
          {GOVERNORATES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {fields.governorate && <p className="text-caption text-danger">{fields.governorate}</p>}
      </div>
      <TextInput
        name="city"
        label="City / area"
        autoComplete="address-level2"
        defaultValue={address?.city}
        error={fields.city}
        disabled={!hydrated}
      />
      <TextInput
        name="line1"
        label="Street address"
        autoComplete="address-line1"
        defaultValue={address?.line1}
        error={fields.line1}
        disabled={!hydrated}
      />
      <TextInput
        name="line2"
        label="Apartment, floor, landmark (optional)"
        autoComplete="address-line2"
        defaultValue={address?.line2}
        required={false}
        disabled={!hydrated}
      />
      <TextInput
        name="label"
        label="Label (optional, e.g. Home)"
        defaultValue={address?.label}
        required={false}
        disabled={!hydrated}
      />
      <label className="flex items-center gap-3 self-end pb-3 text-small">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault ?? false}
          className="size-4 accent-ink"
          disabled={!hydrated}
        />
        Use as my default address
      </label>
      <div className="flex gap-3 md:col-span-2">
        <Button type="submit" loading={busy} disabled={!hydrated}>
          Save address
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ─── Settings ────────────────────────────────────────────────────────────── */

export function SettingsPage() {
  const me = useMe();
  const revalidator = useRevalidator();
  const hydrated = useHydrated();
  const [details, setDetails] = useState<{
    busy: boolean;
    message: string | null;
    error: boolean;
    fields: FieldErrors;
  }>({
    busy: false,
    message: null,
    error: false,
    fields: {},
  });
  const [password, setPassword] = useState<{
    busy: boolean;
    message: string | null;
    error: boolean;
  }>({
    busy: false,
    message: null,
    error: false,
  });

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setDetails({ busy: true, message: null, error: false, fields: {} });
    try {
      await send(
        "/api/account/me",
        {
          name: data.get("name"),
          phone: data.get("phone"),
          marketingOptIn: data.get("marketingOptIn") === "on",
        },
        "PUT",
      );
      await revalidator.revalidate();
      setDetails({ busy: false, message: "Saved.", error: false, fields: {} });
    } catch (problem) {
      setDetails({
        busy: false,
        message: problem instanceof Error ? problem.message : "Couldn’t save.",
        error: true,
        fields: problem instanceof RequestError ? problem.fields : {},
      });
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next = String(data.get("newPassword") ?? "");
    if (next.length < 10) {
      setPassword({ busy: false, message: "Use at least 10 characters.", error: true });
      return;
    }
    setPassword({ busy: true, message: null, error: false });
    try {
      await send("/api/auth/change-password", {
        currentPassword: data.get("currentPassword"),
        newPassword: next,
        revokeOtherSessions: true,
      });
      form.reset();
      setPassword({
        busy: false,
        message: "Password changed. Other devices have been signed out.",
        error: false,
      });
    } catch (problem) {
      setPassword({
        busy: false,
        message: problem instanceof Error ? problem.message : "Couldn’t change it.",
        error: true,
      });
    }
  };

  return (
    <div className="flex max-w-lg flex-col gap-12">
      <section>
        <h2 className="mb-5 label-caps">Your details</h2>
        <form onSubmit={saveDetails} method="post" noValidate className="flex flex-col gap-5">
          <TextInput
            name="name"
            label="Full name"
            autoComplete="name"
            defaultValue={me.name}
            error={details.fields.name}
            disabled={!hydrated}
          />
          <TextInput
            name="email"
            label="Email"
            type="email"
            defaultValue={me.email}
            disabled
            required={false}
            hint="Contact us to change the email on your account."
          />
          <TextInput
            name="phone"
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            defaultValue={localPhone(me.phone)}
            required={false}
            error={details.fields.phone}
            disabled={!hydrated}
          />
          <label className="flex items-center gap-3 text-small">
            <input
              type="checkbox"
              name="marketingOptIn"
              defaultChecked={me.marketingOptIn}
              className="size-4 accent-ink"
              disabled={!hydrated}
            />
            Email me about new collections
          </label>
          <div className="flex items-center gap-4">
            <Button type="submit" loading={details.busy} disabled={!hydrated}>
              Save details
            </Button>
            {details.message && (
              <p
                role={details.error ? "alert" : "status"}
                className={cn("text-small", details.error ? "text-danger" : "text-success")}
              >
                {details.message}
              </p>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-5 label-caps">Password</h2>
        <form onSubmit={changePassword} method="post" noValidate className="flex flex-col gap-5">
          <TextInput
            name="currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
            disabled={!hydrated}
          />
          <TextInput
            name="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 10 characters."
            disabled={!hydrated}
          />
          <div className="flex items-center gap-4">
            <Button type="submit" variant="secondary" loading={password.busy} disabled={!hydrated}>
              Change password
            </Button>
            {password.message && (
              <p
                role={password.error ? "alert" : "status"}
                className={cn("text-small", password.error ? "text-danger" : "text-success")}
              >
                {password.message}
              </p>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
