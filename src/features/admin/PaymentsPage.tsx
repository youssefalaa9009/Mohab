import { useState, type FormEvent } from "react";
import { useLoaderData, useRevalidator, type LoaderFunctionArgs } from "react-router";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/useHydrated";
import { PageHeader } from "./AdminLayout";
import { adminGet, adminPost } from "./api";

type PaymentSettings = {
  instapay: {
    enabled: boolean;
    address: string;
    accountName: string;
    note: string;
    holdHours: number;
  };
};

export async function paymentsLoader(args: LoaderFunctionArgs) {
  return adminGet<PaymentSettings>(args, "/api/admin/payment-settings");
}

const inputClass =
  "h-11 w-full rounded-input border border-line-strong bg-surface px-3 text-small focus:border-ink focus:outline-none disabled:opacity-60";

export function PaymentsPage() {
  const settings = useLoaderData() as PaymentSettings;
  const revalidator = useRevalidator();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      await adminPost(
        "/api/admin/payment-settings",
        {
          instapay: {
            enabled: data.get("enabled") === "on",
            address: String(data.get("address") ?? ""),
            accountName: String(data.get("accountName") ?? ""),
            note: String(data.get("note") ?? ""),
            holdHours: Number(data.get("holdHours") ?? 48),
          },
        },
        "PUT",
      );
      await revalidator.revalidate();
      setMessage({ text: "Saved.", error: false });
    } catch (problem) {
      setMessage({
        text: problem instanceof Error ? problem.message : "Couldn’t save.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const { instapay } = settings;
  return (
    <>
      <PageHeader title="Payments" />
      <div className="flex max-w-xl flex-col gap-8">
        <section className="border border-line bg-surface p-6">
          <h2 className="label-caps">Cash on delivery</h2>
          <p className="mt-3 text-small text-muted">
            Always on. Orders wait in the confirmation queue until you call the customer.
          </p>
        </section>

        <form onSubmit={save} method="post" className="border border-line bg-surface p-6">
          <h2 className="label-caps">InstaPay</h2>
          <p className="mt-3 text-small text-muted">
            Customers transfer the order total to your InstaPay address and send you the transaction
            reference. You check your banking app and mark the payment received — InstaPay has no
            automatic confirmation for shops.
          </p>

          <fieldset disabled={!hydrated} className="mt-6 flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="label-caps text-muted">InstaPay address (IPA)</span>
              <input
                name="address"
                defaultValue={instapay.address}
                placeholder="yourname@instapay"
                autoComplete="off"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-caps text-muted">Account name customers will see</span>
              <input
                name="accountName"
                defaultValue={instapay.accountName}
                autoComplete="off"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-caps text-muted">Extra instructions (optional)</span>
              <textarea
                name="note"
                rows={3}
                maxLength={500}
                defaultValue={instapay.note}
                className="w-full rounded-input border border-line-strong bg-surface px-3 py-2 text-small focus:border-ink focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label-caps text-muted">Hold unpaid orders for (hours)</span>
              <input
                name="holdHours"
                type="number"
                min={1}
                max={168}
                step={1}
                required
                defaultValue={instapay.holdHours}
                aria-describedby="hold-hint"
                className={`${inputClass} max-w-32`}
              />
              <span id="hold-hint" className="text-caption text-muted">
                Orders with no transfer reference by then are cancelled automatically and their
                items go back in stock. Customers see this deadline.
              </span>
            </label>
            <label className="flex items-center gap-3 text-small">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={instapay.enabled}
                className="size-4 accent-ink"
              />
              Offer InstaPay at checkout
            </label>
            <div className="flex items-center gap-4">
              <Button type="submit" loading={busy}>
                Save
              </Button>
              {message && (
                <p
                  role={message.error ? "alert" : "status"}
                  className={message.error ? "text-small text-danger" : "text-small text-success"}
                >
                  {message.text}
                </p>
              )}
            </div>
          </fieldset>
        </form>
      </div>
    </>
  );
}
