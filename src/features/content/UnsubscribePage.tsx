import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button, buttonClassName } from "@/components/ui/Button";
import { send } from "@/features/account/api";
import { useHydrated } from "@/hooks/useHydrated";
import { Meta } from "@/lib/seo";

/**
 * Landing page for the signed link in newsletter emails. Unsubscribing takes
 * a click, never just a visit: mail scanners open links on their own.
 */
export function UnsubscribePage() {
  const [params] = useSearchParams();
  const hydrated = useHydrated();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const unsubscribe = async () => {
    setState("busy");
    setError(null);
    try {
      await send("/api/content/newsletter/unsubscribe", { email, token });
      setState("done");
    } catch (problem) {
      setState("idle");
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
    }
  };

  return (
    <main id="main" className="container-page flex flex-1 justify-center py-section">
      <Meta title="Newsletter" noindex />
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-h1">Newsletter</h1>
        {!email || !token ? (
          <p role="alert" className="mt-6 text-muted">
            This unsubscribe link is incomplete. Please use the full link from the email.
          </p>
        ) : state === "done" ? (
          <>
            <p role="status" className="mt-6">
              You’re unsubscribed. <span className="text-muted">{email}</span> won’t receive the
              newsletter any more.
            </p>
            <Link to="/" className={buttonClassName({ variant: "secondary", className: "mt-10" })}>
              Back to QUATTRO
            </Link>
          </>
        ) : (
          <>
            <p className="mt-6 text-muted">
              Stop sending the QUATTRO newsletter to <span className="text-ink">{email}</span>?
            </p>
            {error && (
              <p role="alert" className="mt-4 text-small text-danger">
                {error}
              </p>
            )}
            <Button
              className="mt-10"
              loading={state === "busy"}
              disabled={!hydrated}
              onClick={() => void unsubscribe()}
            >
              Unsubscribe
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
