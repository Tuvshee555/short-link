import { NextResponse, type NextRequest } from "next/server";

import { attachSession, tryLogin } from "@/lib/auth";
import { getAdminConfig } from "@/lib/env";
import { fail, isSameOrigin, readJsonBody, serverFailure } from "@/lib/http";
import { LIMITS, clientKey, hit, peek, reset } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const config = getAdminConfig();
  if (!config.ok) {
    return fail(
      503,
      "not_configured",
      `Admin sign-in isn’t set up yet. Set ${config.missing.join(" and ")} in the server environment.`,
    );
  }

  if (!isSameOrigin(request)) {
    return fail(403, "cross_site", "This request didn’t come from the sign-in page, so it was blocked.");
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const password = typeof parsed.body.password === "string" ? parsed.body.password : "";
  if (!password) {
    return fail(400, "missing_password", "Enter your password.", { field: "password" });
  }

  try {
    const key = clientKey("login", request.headers, config.secret);

    const before = await peek(key, LIMITS.loginFailures);
    if (before.limited) {
      return fail(
        429,
        "rate_limited",
        `Too many wrong passwords. Try again in ${Math.ceil(before.retryAfterSeconds / 60)} minute(s).`,
        { retryAfterSeconds: before.retryAfterSeconds },
        { "Retry-After": String(before.retryAfterSeconds) },
      );
    }

    const session = tryLogin(password);
    if (!session) {
      await hit(key, LIMITS.loginFailures);
      return fail(401, "invalid_password", "That password isn’t right.", { field: "password" });
    }

    await reset(key);
    return attachSession(NextResponse.json({ ok: true }), session.token);
  } catch (error) {
    return serverFailure("login", error);
  }
}
