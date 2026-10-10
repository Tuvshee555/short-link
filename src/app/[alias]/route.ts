import { ALIAS_PATTERN } from "@/lib/alias";
import { shouldCountClick } from "@/lib/clicks";
import { resolveAlias } from "@/lib/links";
import { notFoundPage, unavailablePage } from "@/lib/messagePage";

// A redirect must reflect the database *now*: an edited destination or a deleted
// link takes effect on the next click, so nothing here may be cached.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ alias: string }> };

async function redirectFor(request: Request, { params }: Context): Promise<Response> {
  const { alias: rawAlias } = await params;

  let decoded = rawAlias;
  try {
    decoded = decodeURIComponent(rawAlias);
  } catch {
    return notFoundPage();
  }

  // Aliases are stored lowercase, so /Hotel-Booking and /hotel-booking are the same link.
  const alias = decoded.toLowerCase();

  // Cheap rejection before touching the database: favicon.ico, scanners probing
  // /wp-login.php, anything that could never be a stored alias.
  if (!ALIAS_PATTERN.test(alias)) return notFoundPage();

  let destination: string | null;
  try {
    destination = await resolveAlias(alias, shouldCountClick(request.method, request.headers));
  } catch (error) {
    console.error("[short-link] redirect lookup failed:", error);
    // Never guess a destination when the database is down.
    return unavailablePage();
  }

  if (!destination) return notFoundPage(alias);

  let location: string;
  try {
    // `href` percent-encodes anything non-ASCII (a Location header must be ASCII)
    // and leaves the query string exactly as stored.
    location = new URL(destination).href;
  } catch {
    console.error(`[short-link] stored destination for "${alias}" is not a valid URL`);
    return unavailablePage();
  }

  return new Response(null, {
    // 302: temporary, so browsers never cache the old destination after an edit.
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export const GET = redirectFor;
export const HEAD = redirectFor;
