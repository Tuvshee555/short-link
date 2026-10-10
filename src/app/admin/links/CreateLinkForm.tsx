"use client";

import { CheckCircle2, ExternalLink, Loader2, Plus, Shuffle, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { generateRandomAlias, validateAlias } from "@/lib/alias";
import { validateDestination } from "@/lib/destination";
import type { LinkDTO } from "@/lib/types";

import CopyButton from "./CopyButton";
import { ApiError, api, displayUrl } from "./client";

type Availability =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable"; message: string };

/** The server's answer for one specific alias. Keyed by alias so a stale answer can never be shown for another. */
type ServerCheck = { alias: string; state: "available" | "unavailable" | "unknown"; message?: string };

type Props = {
  /** Host shown in front of the alias, e.g. "uudamtravel.mn". */
  host: string;
  onCreated: (link: LinkDTO) => void;
};

export default function CreateLinkForm({ host, onCreated }: Props) {
  const [destination, setDestination] = useState("");
  const [alias, setAlias] = useState("");
  const [serverCheck, setServerCheck] = useState<ServerCheck | null>(null);
  const [errors, setErrors] = useState<{ destination?: string; alias?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<LinkDTO | null>(null);
  const destinationRef = useRef<HTMLInputElement>(null);

  // Instant, local verdict (same rules as the server) ...
  const local = alias.trim() === "" ? null : validateAlias(alias);
  const normalized = local?.ok ? local.alias : null;

  // ... then the server's verdict on whether it's actually free, debounced.
  useEffect(() => {
    if (!normalized) return;

    const timer = setTimeout(async () => {
      try {
        const result = await api<{ available: boolean; message?: string }>(
          `/api/links/check?alias=${encodeURIComponent(normalized)}`,
        );
        setServerCheck({
          alias: normalized,
          state: result.available ? "available" : "unavailable",
          message: result.message,
        });
      } catch {
        // Not fatal: submitting will report any real problem.
        setServerCheck({ alias: normalized, state: "unknown" });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [normalized]);

  const answer = serverCheck && serverCheck.alias === normalized ? serverCheck : null;
  const availability: Availability = !local
    ? { status: "idle" }
    : !local.ok
      ? { status: "unavailable", message: local.message }
      : !answer
        ? { status: "checking" }
        : answer.state === "available"
          ? { status: "available" }
          : answer.state === "unavailable"
            ? { status: "unavailable", message: answer.message ?? "That alias isn’t available." }
            : { status: "idle" };

  function changeAlias(next: string) {
    setAlias(next);
    setServerCheck(null); // never show an old answer for a re-typed alias
    if (errors.alias) setErrors((prev) => ({ ...prev, alias: undefined }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: typeof errors = {};

    const checkedDestination = validateDestination(destination);
    if (!checkedDestination.ok) nextErrors.destination = checkedDestination.message;

    const wantsRandom = alias.trim() === "";
    if (!wantsRandom) {
      const checkedAlias = validateAlias(alias);
      if (!checkedAlias.ok) nextErrors.alias = checkedAlias.message;
    }

    setErrors(nextErrors);
    if (nextErrors.destination || nextErrors.alias) {
      if (nextErrors.destination) destinationRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const { link } = await api<{ link: LinkDTO }>("/api/links", {
        method: "POST",
        body: JSON.stringify({ destination, alias, random: wantsRandom }),
      });
      setCreated(link);
      setDestination("");
      changeAlias("");
      onCreated(link);
    } catch (error) {
      if (error instanceof ApiError && error.field) {
        setErrors({ [error.field]: error.message });
      } else {
        setErrors({ form: error instanceof Error ? error.message : "Something went wrong. Try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function createAnother() {
    setCreated(null);
    setErrors({});
    destinationRef.current?.focus();
  }

  const aliasError = errors.alias ?? (availability.status === "unavailable" ? availability.message : undefined);

  return (
    <section aria-labelledby="create-heading" className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <h2 id="create-heading" className="text-base font-semibold tracking-tight">
        Create a short link
      </h2>

      {created && (
        <div role="status" className="mt-4 rounded-xl border border-success/25 bg-success-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Short link created
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={created.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 break-all text-lg font-semibold text-brand underline-offset-4 hover:underline"
            >
              {displayUrl(created.shortUrl)}
            </a>
            <CopyButton text={created.shortUrl} label={`Copy ${displayUrl(created.shortUrl)}`} variant="labelled" />
            <a
              href={created.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-canvas"
            >
              <ExternalLink className="size-4" aria-hidden="true" /> Open
            </a>
            <button
              type="button"
              onClick={createAnother}
              className="h-9 rounded-lg px-3 text-sm font-medium text-muted hover:bg-white hover:text-ink"
            >
              Create another
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4">
        <div>
          <label htmlFor="destination" className="block text-sm font-medium">
            Destination URL
          </label>
          <input
            ref={destinationRef}
            id="destination"
            name="destination"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://www.booking.com/hotel/…"
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              if (errors.destination) setErrors((prev) => ({ ...prev, destination: undefined }));
            }}
            aria-invalid={errors.destination ? true : undefined}
            aria-describedby={errors.destination ? "destination-error" : "destination-hint"}
            className="mt-1.5 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm placeholder:text-muted/70 focus:border-accent aria-[invalid=true]:border-danger"
          />
          {errors.destination ? (
            <p id="destination-error" role="alert" className="mt-1.5 text-sm text-danger">
              {errors.destination}
            </p>
          ) : (
            <p id="destination-hint" className="mt-1.5 text-xs text-muted">
              Paste the full address, including anything after the “?”. It’s saved exactly as you paste it.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="alias" className="block text-sm font-medium">
            Custom alias <span className="font-normal text-muted">(optional)</span>
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <div
              // `flex-1` only from `sm` up: in the stacked phone layout it would collapse the height.
              className={`flex h-11 min-w-0 items-center rounded-lg border bg-white focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/25 sm:flex-1 ${
                aliasError ? "border-danger" : "border-line"
              }`}
            >
              <span className="select-none pl-3 text-sm text-muted" aria-hidden="true">
                {host}/
              </span>
              <input
                id="alias"
                name="alias"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={80}
                placeholder="hotel-booking"
                value={alias}
                onChange={(e) => changeAlias(e.target.value)}
                aria-invalid={aliasError ? true : undefined}
                aria-describedby="alias-status"
                className="h-full min-w-0 flex-1 rounded-r-lg bg-transparent px-1 pr-3 text-sm placeholder:text-muted/70 focus-visible:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => changeAlias(generateRandomAlias())}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-canvas"
            >
              <Shuffle className="size-4" aria-hidden="true" /> Random
            </button>
          </div>

          <p id="alias-status" aria-live="polite" className="mt-1.5 min-h-5 text-sm">
            {aliasError ? (
              <span role={errors.alias ? "alert" : undefined} className="flex items-start gap-1.5 text-danger">
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {aliasError}
              </span>
            ) : availability.status === "checking" ? (
              <span className="flex items-center gap-1.5 text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking…
              </span>
            ) : availability.status === "available" ? (
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="size-4" aria-hidden="true" /> Available
              </span>
            ) : (
              <span className="text-xs text-muted">
                Letters, numbers, hyphens and underscores. Leave blank for a random one.
              </span>
            )}
          </p>
        </div>

        {errors.form && (
          <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
            {errors.form}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {submitting ? "Creating…" : "Create Short Link"}
          </button>
        </div>
      </form>
    </section>
  );
}
