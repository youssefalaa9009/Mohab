import { useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";
import { Link } from "react-router";
import { Button } from "@/components/ui/Button";
import { site } from "@/config/site";
import { RequestError, send, type FieldErrors } from "@/features/account/api";
import { TextInput } from "@/features/account/AuthPages";
import { useHydrated } from "@/hooks/useHydrated";
import { ContentShell } from "./ContentShell";

export function ContactPage() {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await send("/api/content/contact", Object.fromEntries(data));
      track("contact_sent");
      setSent(true);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      if (problem instanceof RequestError) {
        setFields(problem.fields);
        const first = Object.keys(problem.fields)[0];
        if (first) document.getElementById(first)?.focus();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ContentShell
      title="Contact"
      eyebrow="Help"
      description="Get in touch with QUATTRO about an order, sizing or anything else."
      intro={
        <>
          Questions about an order? Have your order number ready, or{" "}
          <Link to="/help/track-order" className="text-ink underline">
            track it here
          </Link>
          .
        </>
      }
      wide
    >
      <div className="grid-page gap-y-12">
        <div className="col-span-4 md:col-span-8 lg:col-span-6">
          {sent ? (
            <div role="status" className="border border-line bg-surface px-6 py-10">
              <p className="font-display text-h3">Thank you — your message is in.</p>
              <p className="mt-3 text-muted">We’ll reply to the email you gave us.</p>
            </div>
          ) : (
            <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
              {error && (
                <p role="alert" className="border border-danger px-4 py-3 text-small text-danger">
                  {error}
                </p>
              )}
              <TextInput
                name="name"
                label="Name"
                autoComplete="name"
                error={fields.name}
                disabled={!hydrated}
              />
              <TextInput
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                error={fields.email}
                disabled={!hydrated}
              />
              <TextInput
                name="subject"
                label="Subject"
                error={fields.subject}
                disabled={!hydrated}
              />
              <div className="flex flex-col gap-2">
                <label htmlFor="message" className="label-caps text-muted">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  required
                  maxLength={5000}
                  disabled={!hydrated}
                  aria-invalid={fields.message ? true : undefined}
                  aria-describedby={fields.message ? "message-error" : undefined}
                  className="rounded-input border border-line-strong bg-surface px-4 py-3 focus:border-ink focus:outline-none disabled:opacity-60 aria-invalid:border-danger"
                />
                {fields.message && (
                  <p id="message-error" className="text-caption text-danger">
                    {fields.message}
                  </p>
                )}
              </div>
              {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
              <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <Button type="submit" loading={busy} disabled={!hydrated} className="self-start">
                Send message
              </Button>
            </form>
          )}
        </div>

        <aside className="col-span-4 md:col-span-8 lg:col-span-4 lg:col-start-9">
          <dl className="flex flex-col gap-6 text-small">
            <div>
              <dt className="label-caps text-muted">Email</dt>
              <dd className="mt-1">{site.contact.email}</dd>
            </div>
            <div>
              <dt className="label-caps text-muted">Phone</dt>
              <dd className="mt-1">{site.contact.phone}</dd>
            </div>
            <div>
              <dt className="label-caps text-muted">Hours</dt>
              <dd className="mt-1">{site.contact.hours}</dd>
            </div>
            <div>
              <dt className="label-caps text-muted">Address</dt>
              <dd className="mt-1">{site.contact.address}</dd>
            </div>
          </dl>
          <p className="mt-8 text-small text-muted">
            Many answers are in the{" "}
            <Link to="/faq" className="text-ink underline">
              FAQ
            </Link>
            .
          </p>
        </aside>
      </div>
    </ContentShell>
  );
}
