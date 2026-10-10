import { describe, expect, it } from "vitest";

import { DESTINATION_MAX, isOwnHost, validateDestination } from "@/lib/destination";

const BOOKING =
  "https://www.booking.com/hotel/cn/inner-mongolia-grand-wangfujing.en-gb.html?aid=304142&label=gen173nr&sid=abc123&checkin=2026-10-12&checkout=2026-10-14&group_adults=2&no_rooms=1&ss=Inner%20Mongolia%2C%20China&#hotelTmpl";

describe("validateDestination", () => {
  it("accepts a long Booking.com URL and stores it exactly as pasted", () => {
    const result = validateDestination(`  ${BOOKING}  `);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe(BOOKING); // byte-for-byte, only trimmed
      expect(result.host).toBe("www.booking.com");
    }
  });

  it("keeps every query parameter in the Location we will send", () => {
    const result = validateDestination(BOOKING);
    if (!result.ok) throw new Error("expected ok");
    const original = new URL(BOOKING);
    const redirected = new URL(result.href);
    expect(redirected.search).toBe(original.search);
    expect([...redirected.searchParams]).toEqual([...original.searchParams]);
    expect(redirected.hash).toBe("#hotelTmpl");
  });

  it("produces an ASCII-only Location for non-ASCII URLs", () => {
    const result = validateDestination("https://example.com/хөтөч?q=аялал");
    if (!result.ok) throw new Error("expected ok");
    expect(result.href).toMatch(/^[\x20-\x7e]+$/);
    expect(new URL(result.href).searchParams.get("q")).toBe("аялал");
  });

  it("accepts http and https in any case", () => {
    expect(validateDestination("http://example.com").ok).toBe(true);
    expect(validateDestination("HTTPS://Example.com/Path").ok).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "vbscript:msgbox(1)",
    "mailto:a@b.com",
    "tel:+97699112233",
  ])("rejects dangerous or unsupported scheme %s", (url) => {
    const result = validateDestination(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Only http:// and https://");
  });

  it("asks for a scheme when one is missing", () => {
    const result = validateDestination("www.booking.com/hotel");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("https://");
  });

  it.each(["", "   ", undefined, null, 5])("rejects empty or non-string %j", (value) => {
    expect(validateDestination(value).ok).toBe(false);
  });

  it.each(["http:evil.com", "https:/evil.com", "https:///", "http://", "https://exa mple.com", "https://a.com/a\nb"])(
    "rejects malformed %j",
    (value) => {
      expect(validateDestination(value).ok).toBe(false);
    },
  );

  it("rejects embedded credentials (the google.com@evil.com trick)", () => {
    const result = validateDestination("https://google.com@evil.example/login");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("username or password");
  });

  it("enforces the length cap", () => {
    expect(validateDestination(`https://a.com/${"x".repeat(DESTINATION_MAX)}`).ok).toBe(false);
    expect(validateDestination(`https://a.com/${"x".repeat(DESTINATION_MAX - 20)}`).ok).toBe(true);
  });

  describe("abuse hooks", () => {
    it("honours the blocked-host list, including sub-domains", () => {
      const ctx = { blockedHosts: ["bad.example"] };
      expect(validateDestination("https://bad.example/x", ctx).ok).toBe(false);
      expect(validateDestination("https://sub.bad.example/x", ctx).ok).toBe(false);
      expect(validateDestination("https://notbad.example/x", ctx).ok).toBe(true);
    });

    it("blocks pointing a short link at another short link on your own domain", () => {
      const ctx = { ownHosts: ["uudamtravel.mn"] };
      expect(validateDestination("https://uudamtravel.mn/hotel-booking", ctx).ok).toBe(false);
      expect(validateDestination("https://www.uudamtravel.mn/china-trip", ctx).ok).toBe(false);
    });

    it("still allows real pages on your own site", () => {
      const ctx = { ownHosts: ["uudamtravel.mn"] };
      expect(validateDestination("https://uudamtravel.mn/", ctx).ok).toBe(true);
      expect(validateDestination("https://uudamtravel.mn/trips", ctx).ok).toBe(true); // reserved route
      expect(validateDestination("https://uudamtravel.mn/mn/trips/gobi-tour", ctx).ok).toBe(true);
      expect(validateDestination("https://example.com/hotel-booking", ctx).ok).toBe(true);
    });
  });
});

describe("isOwnHost", () => {
  it("matches the host and its sub-domains only", () => {
    expect(isOwnHost("uudamtravel.mn", ["uudamtravel.mn"])).toBe(true);
    expect(isOwnHost("www.uudamtravel.mn", ["uudamtravel.mn"])).toBe(true);
    expect(isOwnHost("evil-uudamtravel.mn", ["uudamtravel.mn"])).toBe(false);
    expect(isOwnHost("uudamtravel.mn.evil.com", ["uudamtravel.mn"])).toBe(false);
  });
});
