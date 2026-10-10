import { createHmac } from "node:crypto";

import { db } from "./db";

/**
 * Fixed-window rate limiting backed by Postgres, so the limit holds across every
 * serverless instance. Keys are salted hashes — raw IP addresses are never stored.
 */

export type Limit = { limit: number; windowSeconds: number };

export type LimitState = { limited: boolean; count: number; retryAfterSeconds: number };

export const LIMITS = {
  /** Wrong passwords per client per 15 minutes. */
  loginFailures: { limit: 5, windowSeconds: 15 * 60 },
  /** Create / edit / delete calls per client per minute. */
  writes: { limit: 60, windowSeconds: 60 },
} satisfies Record<string, Limit>;

export function clientKey(scope: string, headers: Headers, secret: string): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", secret).update(`${scope}:${ip}`).digest("hex").slice(0, 40);
}

type Row = { count: number; retry_after: number };

/** Count one event and report whether the caller is now over the limit. */
export async function hit(key: string, { limit, windowSeconds }: Limit): Promise<LimitState> {
  const rows = await db.$queryRaw<Row[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, (now() AT TIME ZONE 'utc'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'utc') - (${windowSeconds}::int * interval '1 second')
        THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'utc') - (${windowSeconds}::int * interval '1 second')
        THEN (now() AT TIME ZONE 'utc') ELSE "RateLimit"."windowStart" END
    RETURNING "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("windowStart" + (${windowSeconds}::int * interval '1 second') - (now() AT TIME ZONE 'utc')))))::int AS retry_after`;

  const row = rows[0];
  void sweepOldRows();
  return { limited: row.count > limit, count: row.count, retryAfterSeconds: row.retry_after };
}

/** Look without counting — used before checking a password. */
export async function peek(key: string, { limit, windowSeconds }: Limit): Promise<LimitState> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("windowStart" + (${windowSeconds}::int * interval '1 second') - (now() AT TIME ZONE 'utc')))))::int AS retry_after
    FROM "RateLimit"
    WHERE "key" = ${key}
      AND "windowStart" >= (now() AT TIME ZONE 'utc') - (${windowSeconds}::int * interval '1 second')`;

  const row = rows[0];
  if (!row) return { limited: false, count: 0, retryAfterSeconds: 0 };
  return { limited: row.count >= limit, count: row.count, retryAfterSeconds: row.retry_after };
}

export async function reset(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** ~2% of calls clear expired counters so the table never grows. Best effort. */
async function sweepOldRows(): Promise<void> {
  if (Math.random() > 0.02) return;
  try {
    await db.rateLimit.deleteMany({
      where: { windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  } catch {
    // Housekeeping only — never worth failing a request over.
  }
}
