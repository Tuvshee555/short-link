import { ALIAS_PATTERN } from "./alias";
import { isReservedAlias } from "./reserved";

export const DESTINATION_MAX = 8192;

export type DestinationContext = {
  /** Hosts that are "our own website" — used to flag redirect loops. */
  ownHosts?: readonly string[];
  /** Hosts nobody may shorten. The hook for abuse controls (see README). */
  blockedHosts?: readonly string[];
};

export type DestinationCheck =
  | {
      ok: true;
      /** The URL exactly as the owner pasted it (trimmed). This is what we store. */
      url: string;
      /** Browser-normalised form. This is what we send in the Location header. */
      href: string;
      host: string;
    }
  | { ok: false; message: string };

/** `host` is `own` or a sub-domain of it. */
export function hostMatches(host: string, own: string): boolean {
  const h = host.toLowerCase();
  const o = own.toLowerCase();
  return h === o || h.endsWith(`.${o}`);
}

export function isOwnHost(host: string, ownHosts: readonly string[]): boolean {
  return ownHosts.some((own) => hostMatches(host, own));
}

/**
 * Validates a destination. Only http(s) is accepted, and the string we store is
 * the one the owner pasted — never a re-serialised version — so query strings
 * survive byte-for-byte.
 */
export function validateDestination(raw: unknown, ctx: DestinationContext = {}): DestinationCheck {
  if (typeof raw !== "string") {
    return { ok: false, message: "Enter the destination URL." };
  }

  const url = raw.trim();

  if (url.length === 0) {
    return { ok: false, message: "Enter the destination URL." };
  }
  if (url.length > DESTINATION_MAX) {
    return { ok: false, message: `That URL is too long (max ${DESTINATION_MAX} characters).` };
  }
  if (/[\s\u0000-\u001f\u007f]/.test(url)) {
    return {
      ok: false,
      message: "The URL contains spaces or line breaks. Copy it again from the address bar.",
    };
  }

  // Check the scheme on the raw text first: `new URL("http:evil.com")` happily
  // parses, and `javascript:` / `data:` / `file:` must never get through.
  if (!/^https?:\/\//i.test(url)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      return { ok: false, message: "Only http:// and https:// URLs can be shortened." };
    }
    return { ok: false, message: "Start the URL with https:// (or http://)." };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, message: "That doesn’t look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, message: "Only http:// and https:// URLs can be shortened." };
  }
  if (!parsed.hostname) {
    return { ok: false, message: "That URL has no website address in it." };
  }
  if (parsed.username || parsed.password) {
    // `https://google.com@evil.example` is the classic phishing disguise.
    return {
      ok: false,
      message: "URLs with a username or password in them (…@…) can’t be shortened.",
    };
  }

  const host = parsed.hostname.toLowerCase();

  if (ctx.blockedHosts?.some((blocked) => hostMatches(host, blocked))) {
    return { ok: false, message: "That website is on the blocked list." };
  }

  if (ctx.ownHosts && isOwnHost(host, ctx.ownHosts)) {
    const segments = parsed.pathname.split("/").filter(Boolean);
    const only = segments.length === 1 ? segments[0].toLowerCase() : null;
    if (only && ALIAS_PATTERN.test(only) && !isReservedAlias(only)) {
      return {
        ok: false,
        message:
          "That points at another short link on this domain, which can create a redirect loop. Use that link’s final destination instead.",
      };
    }
  }

  return { ok: true, url, href: parsed.href, host };
}
