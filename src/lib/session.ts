import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless signed-cookie sessions for a single admin. Pure functions of
 * (secret, password, now) so they are trivially testable.
 *
 *   token = "v1." + base64url(JSON{ exp, k }) + "." + base64url(HMAC-SHA256)
 *
 * `k` is derived from the current ADMIN_PASSWORD, so changing the password (or
 * rotating the secret) invalidates every outstanding session at once.
 */

export const SESSION_COOKIE = "sl_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type Payload = { exp: number; k: string };

function sign(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

function passwordFingerprint(secret: string, password: string): string {
  return createHmac("sha256", secret).update(`admin-password:${password}`).digest("hex").slice(0, 24);
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Constant-time password check that does not leak the password's length. */
export function passwordMatches(input: string, expected: string, secret: string): boolean {
  const a = createHmac("sha256", secret).update(input).digest();
  const b = createHmac("sha256", secret).update(expected).digest();
  return timingSafeEqual(a, b);
}

export function createSessionToken(secret: string, password: string, nowMs: number = Date.now()): string {
  const payload: Payload = {
    exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS,
    k: passwordFingerprint(secret, password),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(secret, `v1.${body}`).toString("base64url");
  return `v1.${body}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  password: string,
  nowMs: number = Date.now(),
): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [, body, signature] = parts;

  const expected = sign(secret, `v1.${body}`).toString("base64url");
  if (!safeEqual(signature, expected)) return false;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  if (typeof payload.exp !== "number" || typeof payload.k !== "string") return false;
  if (payload.exp <= Math.floor(nowMs / 1000)) return false;

  return safeEqual(payload.k, passwordFingerprint(secret, password));
}
