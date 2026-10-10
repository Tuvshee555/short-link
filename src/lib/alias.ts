import { isReservedAlias } from "./reserved";

/**
 * Isomorphic on purpose: the dashboard uses the same rules for instant inline
 * feedback that the server uses for the real decision. The server is still the
 * only authority — never trust the client's verdict.
 */

export const ALIAS_MAX = 64;

/** Must match the CHECK constraint in the init migration. */
export const ALIAS_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

// No 0/o, 1/l/i — random codes get read aloud and typed from print.
const RANDOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const RANDOM_ALIAS_LENGTH = 7;

export type AliasCheck =
  | { ok: true; alias: string }
  | { ok: false; alias: string; message: string };

/** Trim, lowercase, spaces -> hyphens, drop leading slashes. */
export function normalizeAlias(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^\/+/, "");
}

export function validateAlias(raw: unknown): AliasCheck {
  if (typeof raw !== "string") {
    return { ok: false, alias: "", message: "Enter an alias." };
  }

  const alias = normalizeAlias(raw);

  if (alias.length === 0) {
    return { ok: false, alias, message: "Enter an alias." };
  }
  if (alias.length > ALIAS_MAX) {
    return { ok: false, alias, message: `Aliases can be at most ${ALIAS_MAX} characters.` };
  }
  if (alias.includes("/")) {
    return { ok: false, alias, message: "An alias can’t contain slashes — it’s a single word, like hotel-booking." };
  }

  const bad = alias.match(/[^a-z0-9_-]/);
  if (bad) {
    return {
      ok: false,
      alias,
      message: `Only letters a–z, numbers, hyphens and underscores are allowed (found “${bad[0]}”).`,
    };
  }
  if (!ALIAS_PATTERN.test(alias)) {
    return { ok: false, alias, message: "An alias must start and end with a letter or number." };
  }
  if (isReservedAlias(alias)) {
    return { ok: false, alias, message: `“${alias}” is reserved for the website itself. Pick another.` };
  }

  return { ok: true, alias };
}

/** Unbiased random code (rejection sampling), works in Node and the browser. */
export function generateRandomAlias(length: number = RANDOM_ALIAS_LENGTH): string {
  const limit = 256 - (256 % RANDOM_ALPHABET.length);
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit && out.length < length) {
        out += RANDOM_ALPHABET[byte % RANDOM_ALPHABET.length];
      }
    }
  }
  return out;
}
