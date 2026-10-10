import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import { getAdminConfig } from "./env";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  passwordMatches,
  verifySessionToken,
} from "./session";

/** For server components: is the current visitor the signed-in admin? */
export async function isAdminSession(): Promise<boolean> {
  const config = getAdminConfig();
  if (!config.ok) return false;
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value, config.secret, config.password);
}

/** For route handlers: same check against the request's cookies. */
export function isAdminRequest(request: NextRequest): boolean {
  const config = getAdminConfig();
  if (!config.ok) return false;
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, config.secret, config.password);
}

/** Returns a session only if the password is right AND the app is configured. */
export function tryLogin(input: string): { token: string } | null {
  const config = getAdminConfig();
  if (!config.ok) return null;
  if (!passwordMatches(input, config.password, config.secret)) return null;
  return { token: createSessionToken(config.secret, config.password) };
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function attachSession(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, { ...cookieBase, maxAge: SESSION_TTL_SECONDS });
  return response;
}

export function clearSession(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return response;
}
