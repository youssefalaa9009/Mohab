import { useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useHydrated } from "@/hooks/useHydrated";

/** Footer signup. The reply is the same for new and known addresses. */
export function NewsletterForm() {
  const hydrated = useHydrated();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setState("busy");
    setError(null);
    const response = await fetch("/api/content/newsletter", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, source: "footer" }),
    }).catch(() => null);
    if (response?.ok) {
      track("newsletter_signup", { source: "footer" });
      setState("done");
      return;
    }
    setState("idle");
    setError(
      response?.status === 429
        ? "Too many attempts. Please try again in a few minutes."
        : response?.status === 400
          ? "Enter a valid email address."
          : "Connection problem. Please try again.",
    );
  };

  if (state === "done") {
    return (
      <p role="status" className="mt-5 text-small text-bone">
        You’re on the list. Thank you.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 flex flex-col gap-3"
      aria-label="Newsletter signup"
      method="post"
      noValidate
    >
      <Field label="Email address" className="[&_label]:text-bone/60">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={!hydrated}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "newsletter-error" : undefined}
          placeholder="you@example.com"
          className="border-bone/30 bg-transparent text-bone placeholder:text-bone/40 focus:border-bone"
        />
      </Field>
      {error && (
        <p id="newsletter-error" role="alert" className="text-caption text-bone">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="secondary"
        loading={state === "busy"}
        disabled={!hydrated}
        className="border-bone text-bone hover:bg-bone hover:text-night"
      >
        Subscribe
      </Button>
    </form>
  );
}
