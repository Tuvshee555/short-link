import { describe, expect, it } from "vitest";

import { shouldCountClick } from "@/lib/clicks";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const h = (init: Record<string, string>) => new Headers(init);

describe("shouldCountClick", () => {
  it("counts a real browser GET", () => {
    expect(shouldCountClick("GET", h({ "user-agent": CHROME }))).toBe(true);
    expect(shouldCountClick("GET", h({ "user-agent": IPHONE }))).toBe(true);
  });

  it("counts a request with no user agent at all", () => {
    expect(shouldCountClick("GET", h({}))).toBe(true);
  });

  it("does not count HEAD (link checkers, chat apps)", () => {
    expect(shouldCountClick("HEAD", h({ "user-agent": CHROME }))).toBe(false);
  });

  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "WhatsApp/2.23.20.0",
    "TelegramBot (like TwitterBot)",
    "Slackbot-LinkExpanding 1.0",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "Mozilla/5.0 HeadlessChrome/120.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0) Chrome-Lighthouse",
  ])("does not count machine traffic: %s", (ua) => {
    expect(shouldCountClick("GET", h({ "user-agent": ua }))).toBe(false);
  });

  it("does not count browser prefetches", () => {
    expect(shouldCountClick("GET", h({ "user-agent": CHROME, "sec-purpose": "prefetch" }))).toBe(false);
    expect(shouldCountClick("GET", h({ "user-agent": CHROME, purpose: "prefetch" }))).toBe(false);
    expect(shouldCountClick("GET", h({ "user-agent": CHROME, "sec-purpose": "prefetch;prerender" }))).toBe(false);
  });
});
