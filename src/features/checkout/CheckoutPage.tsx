import { ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { track } from "@/lib/analytics";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLoaderData, useNavigate, type LoaderFunctionArgs } from "react-router";
import { Button, buttonClassName } from "@/components/ui/Button";
import { CartTotals, CouponForm } from "@/features/cart/CartLines";
import { useCart } from "@/features/cart/CartProvider";
import { useHydrated } from "@/hooks/useHydrated";
import type { CartView } from "@/features/cart/types";
import { ProductImage } from "@/features/catalog/components/ProductImage";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { Meta } from "@/lib/seo";
import {
  GOVERNORATES,
  checkoutSchema,
  fieldErrors,
  type InstapayDetails,
  type ShippingOption,
} from "./schema";

type Errors = Record<string, string>;

/** 128 random bits as hex. getRandomValues also works on plain-http dev URLs (randomUUID doesn't). */
function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

type CheckoutDefaults = {
  name: string;
  email: string;
  phone: string | null;
  address: {
    fullName: string;
    phone: string;
    governorate: string;
    city: string;
    line1: string;
    line2: string | null;
  } | null;
};

/** Signed-in shoppers get their details prefilled; guests get null (no redirect). */
type PaymentMethods = { cod: boolean; instapay: InstapayDetails | null };

type CheckoutData = { defaults: CheckoutDefaults | null; payment: PaymentMethods };

/** Saved details for signed-in shoppers (null for guests) and the payment methods on offer. */
export async function checkoutLoader(args: LoaderFunctionArgs): Promise<CheckoutData> {
  const json = { headers: { accept: "application/json" } };
  const [defaults, payment] = await Promise.all([
    apiFetch(args, "/api/account/checkout-defaults", json),
    apiFetch(args, "/api/checkout/payment-methods", json),
  ]);
  return {
    defaults: defaults.ok ? ((await defaults.json()) as CheckoutDefaults) : null,
    // If the lookup fails, cash on delivery alone is always safe to offer.
    payment: payment.ok
      ? ((await payment.json()) as PaymentMethods)
      : { cod: true, instapay: null },
  };
}

/** Stored numbers are E.164 (+201…); the form shows the familiar local 01… form. */
const localPhone = (e164: string | null | undefined) =>
  e164?.startsWith("+20") ? `0${e164.slice(3)}` : e164;

export function CheckoutPage() {
  const { cart, refresh } = useCart();
  const hydrated = useHydrated();
  const { defaults, payment } = useLoaderData() as CheckoutData;
  const saved = defaults?.address ?? null;
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const idempotencyKey = useRef<string | null>(null);

  const [method, setMethod] = useState<"cod" | "instapay">("cod");
  const [governorate, setGovernorate] = useState(saved?.governorate ?? "");
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [rateId, setRateId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delivery options depend on the governorate (and on the bag, for free-delivery thresholds).
  useEffect(() => {
    if (!governorate) return;
    const controller = new AbortController();
    fetch(`/api/checkout/shipping?governorate=${encodeURIComponent(governorate)}`, {
      signal: controller.signal,
      credentials: "same-origin",
    })
      .then((response) => (response.ok ? (response.json() as Promise<ShippingOption[]>) : []))
      .then((next) => {
        setOptions(next);
        setRateId((current) =>
          next.some((option) => option.id === current) ? current : (next[0]?.id ?? null),
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [governorate, cart.total.amount]);

  const shipping = options?.find((option) => option.id === rateId) ?? null;
  const grandTotal = { ...cart.total, amount: cart.total.amount + (shipping?.price ?? 0) };

  if (cart.lines.length === 0) {
    return (
      <main id="main" className="container-page flex-1 py-section">
        <Meta title="Checkout" noindex />
        <h1 className="font-display text-h1">Checkout</h1>
        <p className="mt-6 text-muted">Your bag is empty.</p>
        <Link to="/shop" className={buttonClassName({ variant: "secondary", className: "mt-8" })}>
          Continue shopping
        </Link>
      </main>
    );
  }

  // Focus the first invalid field in on-screen order — not the schema's order.
  const focusFirstError = (next: Errors) => {
    const fields = Array.from(formRef.current?.elements ?? []) as HTMLInputElement[];
    fields.find((field) => field.name && field.name in next)?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);

    const data = new FormData(event.currentTarget);
    const input = {
      fullName: String(data.get("fullName") ?? ""),
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      governorate: String(data.get("governorate") ?? ""),
      city: String(data.get("city") ?? ""),
      line1: String(data.get("line1") ?? ""),
      line2: String(data.get("line2") ?? ""),
      note: String(data.get("note") ?? ""),
      shippingRateId: rateId ?? "",
      paymentMethod: method,
      marketingOptIn: data.get("marketingOptIn") === "on",
      saveAddress: data.get("saveAddress") === "on",
    };

    // Same schema the server enforces — instant feedback, no round trip.
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      const next = fieldErrors(parsed.error);
      setErrors(next);
      setFormError("Please check the highlighted fields.");
      focusFirstError(next);
      return;
    }
    if (cart.hasUnavailable) {
      setFormError("Some items in your bag are no longer available. Please review your bag.");
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      // One key per checkout visit: repeats of this order can never create a second one.
      idempotencyKey.current ??= randomKey();
      const send = () =>
        fetch("/api/checkout", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey.current!,
          },
          body: JSON.stringify(input),
        });
      let response = await send();
      // The same order is still being placed (e.g. a retry after a dropped
      // connection): wait for it rather than reporting an error.
      for (let attempt = 0; response.status === 409 && attempt < 6; attempt++) {
        const peek = (await response
          .clone()
          .json()
          .catch(() => ({}))) as { code?: string };
        if (peek.code !== "in_progress") break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        response = await send();
      }
      const body = (await response.json().catch(() => ({}))) as {
        number?: string;
        accessKey?: string;
        error?: string;
        fields?: Errors;
      };

      if (response.status === 201 && body.number && body.accessKey) {
        track("order_placed", {
          value: grandTotal.amount / 100,
          currency: grandTotal.currency,
          items: cart.itemCount,
        });
        // Navigate first: refreshing first would flash this page's empty-bag state.
        navigate(`/checkout/confirmation/${body.number}?key=${body.accessKey}`, { replace: true });
        void refresh();
        return;
      }

      if (body.fields) {
        setErrors(body.fields);
        focusFirstError(body.fields);
      }
      setFormError(body.error ?? "We couldn’t place your order. Please try again.");
      // Stock or prices moved under us: show the bag as it is now.
      if (response.status === 409) await refresh();
    } catch {
      setFormError("Connection problem — your order was not placed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main" className="flex-1 pb-section">
      <Meta title="Checkout" noindex />

      <div className="container-page pt-8 lg:pt-12">
        <h1 className="font-display text-h1">Checkout</h1>
      </div>

      {/* Mobile: collapsible summary above the form. */}
      <details className="group container-page mt-6 border-y border-line lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-4">
          <span className="flex items-center gap-2 label-caps">
            Order summary
            <ChevronDown
              aria-hidden
              className="size-4 transition-transform group-open:rotate-180"
            />
          </span>
          <span className="tabular-nums">{formatMoney(grandTotal)}</span>
        </summary>
        <div className="pb-6">
          <Summary cart={cart} shipping={shipping} />
        </div>
      </details>

      <div className="container-page mt-8 grid-page gap-y-10">
        <form
          ref={formRef}
          onSubmit={submit}
          // Never GET: a native submit must not put personal details in the URL.
          method="post"
          noValidate
          className="col-span-4 flex flex-col gap-12 md:col-span-8 lg:col-span-7"
        >
          {formError && (
            <p role="alert" className="border border-danger px-4 py-3 text-small text-danger">
              {formError}
            </p>
          )}

          {/*
            Disabled until hydration: the governorate select is controlled, so a
            choice made before React takes over would be reset and lost.
          */}
          <fieldset disabled={!hydrated} className="contents">
            <Section title="Contact">
              {defaults ? (
                <p className="text-small text-muted">
                  Signed in as <span className="text-ink">{defaults.email}</span>
                </p>
              ) : (
                <p className="text-small text-muted">
                  Have an account?{" "}
                  <Link to="/account/login?next=/checkout" className="text-ink underline">
                    Sign in
                  </Link>{" "}
                  for faster checkout, or continue as a guest.
                </p>
              )}
              <TextField
                name="phone"
                label="Mobile number"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="010 1234 5678"
                hint="We call this number to confirm your order before it ships."
                defaultValue={localPhone(saved?.phone ?? defaults?.phone)}
                error={errors.phone}
              />
              <TextField
                name="email"
                label="Email (optional)"
                type="email"
                autoComplete="email"
                hint="For your receipt and order updates."
                defaultValue={defaults?.email}
                error={errors.email}
              />
            </Section>

            <Section title="Delivery address">
              <TextField
                name="fullName"
                label="Full name"
                autoComplete="name"
                defaultValue={saved?.fullName ?? defaults?.name}
                error={errors.fullName}
              />
              <div className="flex flex-col gap-2">
                <label htmlFor="governorate" className="label-caps text-muted">
                  Governorate
                </label>
                <select
                  id="governorate"
                  name="governorate"
                  autoComplete="address-level1"
                  value={governorate}
                  onChange={(event) => {
                    setGovernorate(event.target.value);
                    setOptions(null);
                  }}
                  aria-invalid={errors.governorate ? true : undefined}
                  aria-describedby={errors.governorate ? "governorate-error" : undefined}
                  className="h-12 w-full rounded-input border border-line-strong bg-surface px-4 focus:border-ink focus:outline-none aria-invalid:border-danger"
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
                {errors.governorate && (
                  <p id="governorate-error" className="text-caption text-danger">
                    {errors.governorate}
                  </p>
                )}
              </div>
              <TextField
                name="city"
                label="City / area"
                autoComplete="address-level2"
                defaultValue={saved?.city}
                error={errors.city}
              />
              <TextField
                name="line1"
                label="Street address"
                autoComplete="address-line1"
                placeholder="Building, street"
                defaultValue={saved?.line1}
                error={errors.line1}
              />
              <TextField
                name="line2"
                label="Apartment, floor, landmark (optional)"
                autoComplete="address-line2"
                defaultValue={saved?.line2}
                error={errors.line2}
              />
            </Section>

            <Section title="Delivery">
              {!governorate ? (
                <p className="text-small text-muted">
                  Choose your governorate to see delivery options.
                </p>
              ) : options === null ? (
                <div role="status" aria-busy className="flex flex-col gap-2">
                  <span className="sr-only">Loading delivery options…</span>
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : options.length === 0 ? (
                <p role="alert" className="text-small text-danger">
                  We don’t deliver to {governorate} yet.
                </p>
              ) : (
                <fieldset className="flex flex-col gap-2">
                  <legend className="sr-only">Delivery option</legend>
                  {options.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center gap-3 border border-line-strong px-4 py-4 has-checked:border-ink"
                    >
                      <input
                        type="radio"
                        name="shippingRateId"
                        value={option.id}
                        checked={rateId === option.id}
                        onChange={() => setRateId(option.id)}
                        className="size-4 accent-ink"
                      />
                      <span className="flex-1 text-small">
                        {option.name}
                        {option.etaMinDays !== null && option.etaMaxDays !== null && (
                          <span className="block text-caption text-muted">
                            {option.etaMinDays}–{option.etaMaxDays} business days
                          </span>
                        )}
                      </span>
                      <span className="text-small tabular-nums">
                        {option.price === 0
                          ? "Free"
                          : formatMoney({ amount: option.price, currency: option.currency })}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {errors.shippingRateId && (
                <p className="text-caption text-danger">{errors.shippingRateId}</p>
              )}
            </Section>

            <Section title="Payment">
              {payment.instapay ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="sr-only">Payment method</legend>
                  <PaymentOption
                    value="cod"
                    checked={method === "cod"}
                    onSelect={setMethod}
                    title="Cash on delivery"
                    detail="Pay in cash when your order arrives. We’ll call you to confirm before it ships."
                  />
                  <PaymentOption
                    value="instapay"
                    checked={method === "instapay"}
                    onSelect={setMethod}
                    title="InstaPay"
                    detail="After you place the order, we’ll show you where to send the transfer. Your order is confirmed once the payment is verified."
                  />
                </fieldset>
              ) : (
                <div className="border border-ink px-4 py-4">
                  <p className="text-small font-medium">Cash on delivery</p>
                  <p className="mt-1 text-caption text-muted">
                    Pay in cash when your order arrives. We’ll call you to confirm before it ships.
                  </p>
                </div>
              )}
              {errors.paymentMethod && (
                <p className="text-caption text-danger">{errors.paymentMethod}</p>
              )}
            </Section>

            <Section title="Notes">
              <div className="flex flex-col gap-2">
                <label htmlFor="note" className="label-caps text-muted">
                  Delivery notes (optional)
                </label>
                <textarea
                  id="note"
                  name="note"
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-input border border-line-strong bg-surface px-4 py-3 focus:border-ink focus:outline-none"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-3 text-small">
                <input type="checkbox" name="marketingOptIn" className="size-4 accent-ink" />
                Email me about new collections (optional)
              </label>
              {defaults && !saved && (
                <label className="flex cursor-pointer items-center gap-3 text-small">
                  <input
                    type="checkbox"
                    name="saveAddress"
                    defaultChecked
                    className="size-4 accent-ink"
                  />
                  Save this address to my account
                </label>
              )}
            </Section>
          </fieldset>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              loading={submitting}
              disabled={
                !hydrated || cart.hasUnavailable || (governorate !== "" && options?.length === 0)
              }
              className="w-full"
            >
              Place order · {formatMoney(grandTotal)}
            </Button>
            <p className="text-caption text-muted">
              By placing your order you agree to our{" "}
              <Link to="/legal/terms" className="underline">
                terms
              </Link>{" "}
              and{" "}
              <Link to="/legal/privacy" className="underline">
                privacy policy
              </Link>
              .
            </p>
          </div>
        </form>

        <aside aria-label="Order summary" className="hidden lg:col-span-5 lg:block">
          <div className="sticky top-[calc(var(--header-height)+2rem)] bg-surface p-6">
            <Summary cart={cart} shipping={shipping} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function Summary({ cart, shipping }: { cart: CartView; shipping: ShippingOption | null }) {
  const total = { ...cart.total, amount: cart.total.amount + (shipping?.price ?? 0) };
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-4">
        {cart.lines.map((line) => (
          <li key={line.id} className={cn("flex gap-3", !line.available && "opacity-50")}>
            <div className="relative w-14 shrink-0">
              <div className="aspect-[4/5]">
                <ProductImage image={line.image} decorative sizes="4rem" />
              </div>
              <span className="absolute -end-2 -top-2 flex size-5 items-center justify-center rounded-full bg-ink text-[0.625rem] text-paper tabular-nums">
                {line.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-small">
              <p>{line.productName}</p>
              <p className="text-caption text-muted">
                {[line.colorName, line.size && `Size ${line.size}`].filter(Boolean).join(" · ")}
              </p>
              {!line.available && <p className="text-caption text-danger">No longer available</p>}
            </div>
            <span className="text-small tabular-nums">{formatMoney(line.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <CouponForm />
      <CartTotals
        cart={{ ...cart, total }}
        shippingLabel={
          shipping
            ? shipping.price === 0
              ? "Free"
              : formatMoney({ amount: shipping.price, currency: shipping.currency })
            : "Choose a governorate"
        }
      />
    </div>
  );
}

function PaymentOption({
  value,
  checked,
  onSelect,
  title,
  detail,
}: {
  value: "cod" | "instapay";
  checked: boolean;
  onSelect: (value: "cod" | "instapay") => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border border-line-strong px-4 py-4 has-checked:border-ink">
      <input
        type="radio"
        name="paymentMethod"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="mt-1 size-4 accent-ink"
      />
      <span>
        <span className="block text-small font-medium">{title}</span>
        <span className="mt-1 block text-caption text-muted">{detail}</span>
      </span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="border-b border-line pb-3 label-caps">{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  name,
  label,
  hint,
  error,
  type = "text",
  defaultValue,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  type?: string;
  autoComplete?: string;
  inputMode?: "tel" | "email" | "text";
  placeholder?: string;
  defaultValue?: string | null | undefined;
}) {
  const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="label-caps text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="h-12 w-full rounded-input border border-line-strong bg-surface px-4 placeholder:text-muted/60 focus:border-ink focus:outline-none aria-invalid:border-danger"
        {...props}
      />
      {hint && (
        <p id={`${name}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
