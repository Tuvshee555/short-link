import { describe, expect, it } from "vitest";

import { ALIAS_PATTERN, generateRandomAlias, normalizeAlias, validateAlias } from "@/lib/alias";

describe("normalizeAlias", () => {
  it("lowercases, trims, turns spaces into hyphens and drops leading slashes", () => {
    expect(normalizeAlias("  Hotel Booking ")).toBe("hotel-booking");
    expect(normalizeAlias("/China-Trip")).toBe("china-trip");
    expect(normalizeAlias("MY_PORTFOLIO")).toBe("my_portfolio");
  });
});

describe("validateAlias", () => {
  it.each(["hotel-booking", "china-trip", "my-portfolio", "instagram", "a", "x1", "a_b", "2026-sale"])(
    "accepts %s",
    (alias) => {
      const result = validateAlias(alias);
      expect(result.ok).toBe(true);
    },
  );

  it("returns the normalised alias", () => {
    expect(validateAlias("  Hotel Booking ")).toEqual({ ok: true, alias: "hotel-booking" });
  });

  it.each([
    ["", "Enter an alias."],
    ["   ", "Enter an alias."],
    ["-leading", "start and end"],
    ["trailing-", "start and end"],
    ["_x", "start and end"],
    ["has/slash", "slashes"],
    ["dot.com", "Only letters"],
    ["emoji😀", "Only letters"],
    ["Хөтөч", "Only letters"],
    ["a&b", "Only letters"],
    ["x".repeat(65), "at most 64"],
  ])("rejects %j", (input, messagePart) => {
    const result = validateAlias(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(messagePart);
  });

  it("accepts exactly 64 characters", () => {
    expect(validateAlias("a".repeat(64)).ok).toBe(true);
  });

  it.each(["admin", "api", "mn", "en", "trips", "ADMIN", "login", "images", "public"])(
    "rejects reserved alias %s",
    (alias) => {
      const result = validateAlias(alias);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("reserved");
    },
  );

  it.each(["apiary", "api-docs", "images-sale", "public-holidays", "favicon-x"])(
    "rejects aliases the website proxy would swallow by prefix: %s",
    (alias) => {
      expect(validateAlias(alias).ok).toBe(false);
    },
  );

  it.each(["apple", "application", "trip-2026", "my-images", "gallery", "mongolia"])(
    "still allows look-alikes that don't START with a reserved prefix: %s",
    (alias) => {
      expect(validateAlias(alias).ok).toBe(true);
    },
  );

  it("rejects non-strings", () => {
    expect(validateAlias(undefined).ok).toBe(false);
    expect(validateAlias(42).ok).toBe(false);
  });
});

describe("generateRandomAlias", () => {
  it("makes valid, unambiguous 7-character codes", () => {
    for (let i = 0; i < 500; i++) {
      const alias = generateRandomAlias();
      expect(alias).toHaveLength(7);
      expect(ALIAS_PATTERN.test(alias)).toBe(true);
      expect(alias).not.toMatch(/[01ilo]/);
    }
  });

  it("does not repeat in a sample (collision sanity check)", () => {
    const seen = new Set(Array.from({ length: 2000 }, () => generateRandomAlias()));
    expect(seen.size).toBe(2000);
  });
});
