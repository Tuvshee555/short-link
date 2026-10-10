import { NextResponse, type NextRequest } from "next/server";

import { isAdminRequest } from "./auth";
import { getAdminConfig } from "./env";
import { LIMITS, clientKey, hit } from "./rateLimit";
import type { ApiErrorBody } from "./types";

const MAX_BODY_BYTES = 20_000;

export function fail(
  status: number,
  code: string,
  message: string,
  extra: Partial<ApiErrorBody["error"]> = {},
  headers?: HeadersInit,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers });
}

/** Last-resort handler for a thrown database/runtime error. Logs, never leaks details. */
export function serverFailure(scope: string, error: unknown): NextResponse<ApiErrorBody> {
  console.error(`[short-link] ${scope} failed:`, error);
  return fail(503, "unavailable", "The database isn’t reachable right now. Try again in a moment.");
}

/**
 * A cookie-authenticated write must come from this site's own pages. Browsers
 * attach `Origin` to every non-GET fetch, so a missing or foreign one is refused.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";

  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Read endpoints: signed-in admin only. */
export function requireAdmin(request: NextRequest): NextResponse<ApiErrorBody> | null {
  if (!getAdminConfig().ok) {
    return fail(503, "not_configured", "Admin sign-in isn’t configured on the server yet.");
  }
  if (!isAdminRequest(request)) {
    return fail(401, "unauthorized", "Your session has expired. Sign in again.");
  }
  return null;
}

/** Write endpoints: admin + same-origin + JSON + rate limit. Returns a response to send, or null to proceed. */
export async function requireAdminWrite(request: NextRequest): Promise<NextResponse<ApiErrorBody> | null> {
  const denied = requireAdmin(request);
  if (denied) return denied;

  if (!isSameOrigin(request)) {
    return fail(403, "cross_site", "This request didn’t come from the dashboard, so it was blocked.");
  }

  if (request.method !== "DELETE" && !request.headers.get("content-type")?.includes("application/json")) {
    return fail(415, "unsupported_media_type", "Send the request body as JSON.");
  }

  const config = getAdminConfig();
  if (config.ok) {
    const state = await hit(clientKey("write", request.headers, config.secret), LIMITS.writes);
    if (state.limited) {
      return fail(
        429,
        "rate_limited",
        "Too many changes in a short time. Wait a moment and try again.",
        { retryAfterSeconds: state.retryAfterSeconds },
        { "Retry-After": String(state.retryAfterSeconds) },
      );
    }
  }

  return null;
}

export type JsonBody = { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse<ApiErrorBody> };

export async function readJsonBody(request: NextRequest): Promise<JsonBody> {
  const text = await request.text();

  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, response: fail(413, "too_large", "That request is too large.") };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ok: true, body: parsed as Record<string, unknown> };
    }
  } catch {
    // fall through
  }
  return { ok: false, response: fail(400, "bad_json", "The request body must be a JSON object.") };
}
