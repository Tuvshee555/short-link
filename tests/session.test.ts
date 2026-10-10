import { describe, expect, it } from "vitest";

import {
  SESSION_TTL_SECONDS,
  createSessionToken,
  passwordMatches,
  safeEqual,
  verifySessionToken,
} from "@/lib/session";

const SECRET = "s".repeat(48);
const PASSWORD = "correct horse battery staple";
const NOW = 1_800_000_000_000;

describe("session tokens", () => {
  it("round-trips", () => {
    const token = createSessionToken(SECRET, PASSWORD, NOW);
    expect(verifySessionToken(token, SECRET, PASSWORD, NOW + 1000)).toBe(true);
  });

  it("expires after the TTL", () => {
    const token = createSessionToken(SECRET, PASSWORD, NOW);
    const justBefore = NOW + (SESSION_TTL_SECONDS - 1) * 1000;
    const justAfter = NOW + (SESSION_TTL_SECONDS + 1) * 1000;
    expect(verifySessionToken(token, SECRET, PASSWORD, justBefore)).toBe(true);
    expect(verifySessionToken(token, SECRET, PASSWORD, justAfter)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken("x".repeat(48), PASSWORD, NOW);
    expect(verifySessionToken(token, SECRET, PASSWORD, NOW)).toBe(false);
  });

  it("is invalidated when the admin password changes", () => {
    const token = createSessionToken(SECRET, PASSWORD, NOW);
    expect(verifySessionToken(token, SECRET, "a new password", NOW)).toBe(false);
  });

  it("rejects a tampered payload (extending the expiry)", () => {
    const [v, body, sig] = createSessionToken(SECRET, PASSWORD, NOW).split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    payload.exp += 10_000_000;
    const forged = `${v}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
    expect(verifySessionToken(forged, SECRET, PASSWORD, NOW)).toBe(false);
  });

  it.each([undefined, null, "", "garbage", "v1.a.b", "v2.a.b", "v1..", "a.b.c.d"])("rejects malformed token %j", (token) => {
    expect(verifySessionToken(token as string | null | undefined, SECRET, PASSWORD, NOW)).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("accepts only the exact password, whatever the length", () => {
    expect(passwordMatches(PASSWORD, PASSWORD, SECRET)).toBe(true);
    expect(passwordMatches("", PASSWORD, SECRET)).toBe(false);
    expect(passwordMatches(PASSWORD + " ", PASSWORD, SECRET)).toBe(false);
    expect(passwordMatches(PASSWORD.toUpperCase(), PASSWORD, SECRET)).toBe(false);
    expect(passwordMatches("x", PASSWORD, SECRET)).toBe(false);
  });
});

describe("safeEqual", () => {
  it("handles different lengths without throwing", () => {
    expect(safeEqual("a", "ab")).toBe(false);
    expect(safeEqual("ab", "ab")).toBe(true);
  });
});
