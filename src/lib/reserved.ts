/**
 * Aliases nobody may claim.
 *
 * Short links live at the ROOT of the domain (`uudamtravel.mn/<alias>`), so an
 * alias must never shadow a real route — of this app, or of the website that
 * forwards unknown root paths here. Keep the website section in sync with
 * `src/app/[locale]/*` of uudam-booking-web (and with SHORTLINK_SKIP in its
 * `src/lib/shortLink.ts`) when a new top-level page is added there.
 */
export const RESERVED_ALIASES: ReadonlySet<string> = new Set([
  // This app
  "admin",
  "login",
  "logout",
  "static",
  "assets",
  "robots",
  "sitemap",
  "icon",
  "404",
  "500",

  // Website locales
  "mn",
  "en",
  "ko",

  // Website top-level pages (uudam-booking-web: src/app/[locale]/*)
  "about",
  "booking",
  "category",
  "contact",
  "custom-trip",
  "data-deletion",
  "departures",
  "discover",
  "faq",
  "gift",
  "guide",
  "provider",
  "qa-pricing",
  "saved",
  "terms",
  "trips",

  // Hostname-ish words that would only confuse people
  "www",
  "null",
  "undefined",
]);

/**
 * The website's proxy treats everything STARTING with these as its own (its
 * static-asset prefixes and its matcher both skip `/api…`, `/images…`,
 * `/public…`, `/favicon…`), so an alias like "apiary" could never be reached
 * on the real domain. Refuse them up front instead of failing mysteriously.
 */
export const RESERVED_PREFIXES: readonly string[] = ["api", "images", "public", "favicon"];

export function isReservedAlias(alias: string): boolean {
  const lower = alias.toLowerCase();
  return RESERVED_ALIASES.has(lower) || RESERVED_PREFIXES.some((prefix) => lower.startsWith(prefix));
}
