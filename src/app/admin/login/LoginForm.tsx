"use client";

import { AlertCircle, Eye, EyeOff, Link2, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApiErrorBody } from "@/lib/types";

type Props = { next: string; expired: boolean; configured: boolean };

export default function LoginForm({ next, expired, configured }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.replace(next);
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      setError(body?.error.message ?? "Couldn’t sign in. Try again.");
    } catch {
      setError("Couldn’t reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white" aria-hidden="true">
            <Link2 className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Short links</h1>
          <p className="mt-1 text-sm text-muted">Sign in to manage your links.</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-white p-6 shadow-sm" noValidate>
          {!configured && (
            <p role="alert" className="mb-4 flex gap-2 rounded-lg bg-warn-soft p-3 text-sm text-warn">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Sign-in isn’t set up on this server yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET to its
              environment, then redeploy.
            </p>
          )}
          {expired && !error && (
            <p role="status" className="mb-4 rounded-lg bg-brand-soft p-3 text-sm text-brand">
              Your session expired. Please sign in again.
            </p>
          )}

          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              className="h-11 w-full rounded-lg border border-line bg-white pl-9 pr-11 text-sm placeholder:text-muted/70 focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide password" : "Show password"}
              aria-pressed={reveal}
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
            >
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {error && (
            <p id="login-error" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
