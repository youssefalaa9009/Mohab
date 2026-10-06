import { useState } from "react";
import { useLoaderData, useRevalidator, type LoaderFunctionArgs } from "react-router";
import { buttonClassName } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/cn";
import { PageHeader } from "./AdminLayout";
import { adminGet, adminPost } from "./api";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  dateStyle: "medium",
  timeStyle: "short",
});

/* ─── Contact messages ───────────────────────────────────────────────────── */

type Message = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "handled";
  createdAt: string;
};

export async function messagesLoader(args: LoaderFunctionArgs) {
  return adminGet<Message[]>(args, "/api/admin/messages");
}

export function MessagesPage() {
  const messages = useLoaderData() as Message[];
  const revalidator = useRevalidator();
  // Buttons below only work through JavaScript: a click before hydration would be lost.
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [showHandled, setShowHandled] = useState(false);
  const shown = showHandled ? messages : messages.filter((message) => message.status === "new");

  const mark = async (id: string, status: Message["status"]) => {
    setError(null);
    try {
      await adminPost(`/api/admin/messages/${id}`, { status }, "PATCH");
      await revalidator.revalidate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Couldn’t update the message.");
    }
  };

  return (
    <>
      <PageHeader title="Messages" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-small text-muted">From the contact form. Reply by email.</p>
        <label className="flex items-center gap-2 text-small">
          <input
            type="checkbox"
            checked={showHandled}
            onChange={(event) => setShowHandled(event.target.checked)}
            disabled={!hydrated}
            className="size-4 accent-ink"
          />
          Show handled
        </label>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-small text-danger">
          {error}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="border border-line px-6 py-16 text-center text-muted">
          {showHandled ? "No messages yet." : "No new messages."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((message) => (
            <li
              key={message.id}
              className={cn(
                "border border-line bg-surface p-5",
                message.status === "handled" && "opacity-60",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{message.subject}</h2>
                <span className="text-caption text-muted">
                  {dateTime.format(new Date(message.createdAt))}
                </span>
              </div>
              <p className="mt-1 text-small text-muted">
                {message.name} ·{" "}
                <a
                  href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}
                  className="text-ink underline"
                >
                  {message.email}
                </a>
              </p>
              <p className="mt-4 text-small whitespace-pre-wrap">{message.message}</p>
              <button
                type="button"
                disabled={!hydrated}
                onClick={() => void mark(message.id, message.status === "new" ? "handled" : "new")}
                className="mt-4 label-caps underline"
              >
                {message.status === "new" ? "Mark handled" : "Mark as new"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ─── Newsletter subscribers ─────────────────────────────────────────────── */

type Subscriber = {
  id: string;
  email: string;
  status: "subscribed" | "unsubscribed";
  source: string | null;
  consentAt: string;
  unsubscribedAt: string | null;
};

type SubscriberData = {
  counts: { subscribed: number; total: number };
  rows: Subscriber[];
};

export async function subscribersLoader(args: LoaderFunctionArgs) {
  return adminGet<SubscriberData>(args, "/api/admin/subscribers");
}

export function SubscribersPage() {
  const { counts, rows } = useLoaderData() as SubscriberData;
  const revalidator = useRevalidator();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);

  const unsubscribe = async (subscriber: Subscriber) => {
    if (!window.confirm(`Unsubscribe ${subscriber.email}?`)) return;
    setError(null);
    try {
      await adminPost(
        `/api/admin/subscribers/${subscriber.id}`,
        { status: "unsubscribed" },
        "PATCH",
      );
      await revalidator.revalidate();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Couldn’t update the subscriber.");
    }
  };

  return (
    <>
      <PageHeader
        title="Newsletter"
        actions={
          // A plain download link: the browser sends the session cookie.
          <a
            href="/api/admin/subscribers.csv"
            download
            className={buttonClassName({ variant: "secondary" })}
          >
            Export CSV
          </a>
        }
      />
      <p className="mb-6 text-small text-muted">
        {counts.subscribed} subscribed · {counts.total - counts.subscribed} unsubscribed. The export
        includes current subscribers only — import it into your email tool.
      </p>
      {error && (
        <p role="alert" className="mb-4 text-small text-danger">
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="border border-line px-6 py-16 text-center text-muted">No subscribers yet.</p>
      ) : (
        <div role="region" aria-label="Subscribers" tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-small">
            <thead>
              <tr className="border-b border-ink">
                {["Email", "Source", "Signed up", ""].map((heading, index) => (
                  <th key={index} scope="col" className="py-2 pe-4 text-start label-caps">
                    {heading || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line">
                  <td className={cn("py-3 pe-4", row.status === "unsubscribed" && "text-muted")}>
                    {row.email}
                    {row.status === "unsubscribed" && (
                      <span className="ms-2 label-caps text-muted">Unsubscribed</span>
                    )}
                  </td>
                  <td className="py-3 pe-4 text-muted">{row.source ?? "—"}</td>
                  <td className="py-3 pe-4 text-muted">
                    {dateTime.format(new Date(row.consentAt))}
                  </td>
                  <td className="py-3 text-end">
                    {row.status === "subscribed" && (
                      <button
                        type="button"
                        disabled={!hydrated}
                        onClick={() => void unsubscribe(row)}
                        className="text-muted underline hover:text-danger"
                      >
                        Unsubscribe
                      </button>
                    )}
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
