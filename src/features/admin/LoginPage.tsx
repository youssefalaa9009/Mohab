import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/useHydrated";

/** Only same-site paths under /admin are honoured, so ?next= can't redirect off-site. */
function safeNext(value: string | null) {
  // "//host" and "/\host" are both treated as off-site by browsers.
  return value && value.startsWith("/admin") && !/^\/[/\\]/.test(value) ? value : "/admin";
}

export function AdminLoginPage() {
  const [params] = useSearchParams();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    }).catch(() => null);
    setBusy(false);

    if (!response) return setError("Connection problem. Please try again.");
    if (response.status === 429) return setError("Too many attempts. Wait a minute and try again.");
    if (!response.ok) return setError("That email and password don’t match a staff account.");
    // Full navigation so the new session cookie applies to the whole admin load.
    window.location.assign(safeNext(params.get("next")));
  };

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-canvas px-gutter">
      <title>Sign in · QUATTRO Admin</title>
      <meta name="robots" content="noindex, nofollow" />
      <div className="w-full max-w-sm">
        <p className="font-display text-h2 tracking-[0.2em]">QUATTRO</p>
        <h1 className="mt-2 label-caps text-muted">Staff sign in</h1>
        <form onSubmit={submit} method="post" className="mt-10 flex flex-col gap-5" noValidate>
          {error && (
            <p role="alert" className="border border-danger px-4 py-3 text-small text-danger">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-2">
            <span className="label-caps text-muted">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={!hydrated}
              className="h-12 rounded-input border border-line-strong bg-surface px-4 focus:border-ink focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="label-caps text-muted">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={!hydrated}
              className="h-12 rounded-input border border-line-strong bg-surface px-4 focus:border-ink focus:outline-none"
            />
          </label>
          <Button type="submit" loading={busy} disabled={!hydrated} className="mt-2">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
