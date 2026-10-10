/**
 * Server-only configuration. Nothing in here may ever be exposed to the
 * browser — there are deliberately no NEXT_PUBLIC_ variables in this app.
 */

export const SESSION_SECRET_MIN_LENGTH = 32;

export type AdminConfig =
  | { ok: true; password: string; secret: string }
  | { ok: false; missing: string[] };

export function getAdminConfig(): AdminConfig {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  const missing: string[] = [];

  if (!password) missing.push("ADMIN_PASSWORD");
  if (secret.length < SESSION_SECRET_MIN_LENGTH) {
    missing.push(`ADMIN_SESSION_SECRET (at least ${SESSION_SECRET_MIN_LENGTH} characters)`);
  }

  return missing.length > 0 ? { ok: false, missing } : { ok: true, password, secret };
}

/** Public base the short links are displayed under, without a trailing slash. */
export function getBaseUrl(): string {
  const explicit = process.env.SHORT_LINK_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3600";
}

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/** Hosts that count as "your own website" (base URL host + OWN_HOSTS). */
export function getOwnHosts(): string[] {
  const hosts = new Set(csv(process.env.OWN_HOSTS));
  try {
    const host = new URL(getBaseUrl()).hostname.toLowerCase();
    hosts.add(host.replace(/^www\./, ""));
  } catch {
    // A malformed base URL just means fewer hosts are recognised as "own".
  }
  return [...hosts];
}

/** Destination hosts that may not be shortened. Comma-separated, optional. */
export function getBlockedHosts(): string[] {
  return csv(process.env.BLOCKED_DESTINATION_HOSTS);
}
