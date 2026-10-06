import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/useHydrated";
import { Meta } from "@/lib/seo";
import { RequestError, safeNext, send, type FieldErrors } from "./api";

function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main id="main" className="container-page flex flex-1 justify-center py-section">
      <Meta title={title} noindex />
      <div className="w-full max-w-md">
        <h1 className="font-display text-h1">{title}</h1>
        {intro && <div className="mt-4 text-muted">{intro}</div>}
        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}

export function TextInput({
  name,
  label,
  type = "text",
  autoComplete,
  error,
  hint,
  defaultValue,
  disabled,
  required = true,
  minLength,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string | undefined;
  hint?: string;
  defaultValue?: string | null | undefined;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
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
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        defaultValue={defaultValue ?? undefined}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="h-12 rounded-input border border-line-strong bg-surface px-4 focus:border-ink focus:outline-none disabled:opacity-60 aria-invalid:border-danger"
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

function useForm() {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await action();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
      if (problem instanceof RequestError) setFields(problem.fields);
    } finally {
      setBusy(false);
    }
  };
  return { hydrated, busy, error, fields, run };
}

function FormError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="border border-danger px-4 py-3 text-small text-danger">
      {error}
    </p>
  ) : null;
}

export function LoginPage() {
  const [params] = useSearchParams();
  const { hydrated, busy, error, run } = useForm();
  const next = safeNext(params.get("next"));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      await send("/api/auth/sign-in/email", {
        email: data.get("email"),
        password: data.get("password"),
      });
      // Full load: every loader (and the header) should see the new session.
      window.location.assign(next);
    });
  };

  return (
    <AuthShell title="Sign in">
      <form onSubmit={submit} method="post" className="flex flex-col gap-5" noValidate>
        <FormError error={error} />
        <TextInput
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          disabled={!hydrated}
        />
        <TextInput
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          disabled={!hydrated}
        />
        <Link
          to="/account/forgot-password"
          className="link-underline self-start text-small text-muted"
        >
          Forgot your password?
        </Link>
        <Button type="submit" loading={busy} disabled={!hydrated}>
          Sign in
        </Button>
      </form>
      <p className="mt-10 border-t border-line pt-6 text-small text-muted">
        New here?{" "}
        <Link
          to={`/account/register${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-ink underline"
        >
          Create an account
        </Link>{" "}
        to track orders and check out faster. You can also check out as a guest.
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const [params] = useSearchParams();
  const { hydrated, busy, error, fields, run } = useForm();
  const next = safeNext(params.get("next"));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password.length < 10) {
      void run(async () => {
        throw new RequestError("Use at least 10 characters for your password.", {
          password: "At least 10 characters.",
        });
      });
      return;
    }
    void run(async () => {
      await send("/api/auth/sign-up/email", {
        name: data.get("name"),
        email: data.get("email"),
        password,
        marketingOptIn: data.get("marketingOptIn") === "on",
      });
      window.location.assign(next);
    });
  };

  return (
    <AuthShell
      title="Create an account"
      intro="Track your orders and save your address for next time."
    >
      <form onSubmit={submit} method="post" className="flex flex-col gap-5" noValidate>
        <FormError error={error} />
        <TextInput
          name="name"
          label="Full name"
          autoComplete="name"
          disabled={!hydrated}
          error={fields.name}
        />
        <TextInput
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          disabled={!hydrated}
          error={fields.email}
        />
        <TextInput
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          hint="At least 10 characters."
          disabled={!hydrated}
          error={fields.password}
        />
        <label className="flex items-center gap-3 text-small">
          <input
            type="checkbox"
            name="marketingOptIn"
            className="size-4 accent-ink"
            disabled={!hydrated}
          />
          Email me about new collections (optional)
        </label>
        <Button type="submit" loading={busy} disabled={!hydrated}>
          Create account
        </Button>
      </form>
      <p className="mt-10 border-t border-line pt-6 text-small text-muted">
        Already have an account?{" "}
        <Link to="/account/login" className="text-ink underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { hydrated, busy, error, run } = useForm();
  const [sent, setSent] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      await send("/api/auth/request-password-reset", {
        email: data.get("email"),
        redirectTo: `${window.location.origin}/account/reset-password`,
      });
      setSent(true);
    });
  };

  return (
    <AuthShell title="Reset your password">
      {sent ? (
        // Same message whether or not the email has an account: no account lookup by email.
        <p role="status" className="text-muted">
          If an account exists for that email, a reset link is on its way. It expires in one hour.
        </p>
      ) : (
        <form onSubmit={submit} method="post" className="flex flex-col gap-5" noValidate>
          <p className="text-muted">
            Enter your email and we’ll send you a link to choose a new password.
          </p>
          <FormError error={error} />
          <TextInput
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            disabled={!hydrated}
          />
          <Button type="submit" loading={busy} disabled={!hydrated}>
            Send reset link
          </Button>
        </form>
      )}
      <Link to="/account/login" className="link-underline mt-10 inline-block label-caps">
        Back to sign in
      </Link>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { hydrated, busy, error, run } = useForm();
  const [done, setDone] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    void run(async () => {
      if (password.length < 10)
        throw new RequestError("Use at least 10 characters for your password.");
      await send("/api/auth/reset-password", { newPassword: password, token });
      setDone(true);
    });
  };

  return (
    <AuthShell title="Choose a new password">
      {!token || params.get("error") ? (
        <p role="alert" className="text-danger">
          This reset link has expired or was already used.{" "}
          <Link to="/account/forgot-password" className="underline">
            Request a new one
          </Link>
          .
        </p>
      ) : done ? (
        <p role="status" className="text-muted">
          Your password has been changed.{" "}
          <Link to="/account/login" className="text-ink underline">
            Sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} method="post" className="flex flex-col gap-5" noValidate>
          <FormError error={error} />
          <TextInput
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            hint="At least 10 characters."
            disabled={!hydrated}
          />
          <Button type="submit" loading={busy} disabled={!hydrated}>
            Save new password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
