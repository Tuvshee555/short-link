import { getBaseUrl } from "./env";

/**
 * Tiny self-contained HTML responses for visitors who follow a short link that
 * can't be served. Plain strings (no React, no Tailwind) so they render even
 * when the rest of the app is unhealthy.
 */

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

type MessagePage = {
  status: number;
  title: string;
  heading: string;
  /** Plain text; escaped here. */
  body: string;
  headers?: Record<string, string>;
};

function render({ status, title, heading, body, headers }: MessagePage): Response {
  const base = getBaseUrl();
  const host = base.replace(/^https?:\/\//, "");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
    background: #f8fafc; color: #0f172a;
    font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  main { width: 100%; max-width: 440px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
    padding: 32px 28px; text-align: center; }
  .code { display: inline-block; font-size: 13px; font-weight: 600; letter-spacing: .04em; color: #113e67;
    background: #eaf1f8; border-radius: 999px; padding: 4px 12px; }
  h1 { margin: 16px 0 8px; font-size: 22px; line-height: 1.25; }
  p { margin: 0 0 24px; color: #475569; overflow-wrap: anywhere; }
  a { display: inline-block; background: #113e67; color: #fff; text-decoration: none; font-weight: 600;
    padding: 11px 20px; border-radius: 10px; }
  a:hover { background: #0c2f4f; }
  a:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <span class="code">${status}</span>
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(body)}</p>
  <a href="${escapeHtml(base)}">Go to ${escapeHtml(host)}</a>
</main>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      ...headers,
    },
  });
}

export function notFoundPage(alias?: string): Response {
  return render({
    status: 404,
    title: "Link not found",
    heading: "This short link doesn’t exist",
    body: alias
      ? `Nothing is saved under “${alias}”. It may have been deleted, or the address was mistyped.`
      : "It may have been deleted, or the address was mistyped.",
  });
}

export function unavailablePage(): Response {
  return render({
    status: 503,
    title: "Temporarily unavailable",
    heading: "We couldn’t load this link",
    body: "The link service is having a moment. Please try again in a few seconds.",
    headers: { "Retry-After": "30" },
  });
}
