// End-to-end check against a RUNNING instance and its real database.
//
//   npm run build && npm start          (in one terminal)
//   npm run e2e                          (in another; reads .env.local)
//
// Env: E2E_BASE_URL (default http://localhost:3600), ADMIN_PASSWORD.
// Every link it creates is prefixed "zz-e2e-" and deleted again, pass or fail.
// Uses throw-away X-Forwarded-For values for the lock-out tests so your own
// sign-in is never rate-limited by running this.

import { PrismaClient } from "@prisma/client";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3600").replace(/\/+$/, "");
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error("ADMIN_PASSWORD is not set (run via `npm run e2e`, which loads .env.local).");
  process.exit(2);
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const BOOKING =
  "https://www.booking.com/hotel/cn/inner-mongolia-grand-wangfujing.en-gb.html?aid=304142&label=gen173nr-1FCAEoggI46AdIM1gEaGyIAQGYAQm4ARfIAQzYAQHoAQH4AQKIAgGoAgO4AtTvq8gGwAIB0gIkNzQ4ZDQ&sid=abc123&checkin=2026-10-12&checkout=2026-10-14&group_adults=2&no_rooms=1&ss=Inner%20Mongolia%2C%20China&#hotelTmpl";
const RUN = Math.random().toString(36).slice(2, 7);
const P = `zz-e2e-${RUN}`;

let passed = 0;
const failures = [];
const createdIds = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `  -> ${detail}` : ""}`);
  }
}

async function http(path, { method = "GET", cookie, origin = BASE, ua = BROWSER_UA, xff, json, raw, headers = {} } = {}) {
  const h = { "user-agent": ua, ...headers };
  if (cookie) h.cookie = cookie;
  if (origin) h.origin = origin;
  if (xff) h["x-forwarded-for"] = xff;
  let body;
  if (json !== undefined) {
    h["content-type"] = "application/json";
    body = JSON.stringify(json);
  } else if (raw !== undefined) {
    body = raw;
  }
  const res = await fetch(BASE + path, { method, headers: h, body, redirect: "manual" });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, headers: res.headers, text, data, res };
}

async function login(password, xff) {
  const r = await http("/api/auth/login", { method: "POST", json: { password }, xff, origin: BASE });
  const setCookie = r.res.headers.getSetCookie?.() ?? [];
  const raw = setCookie.find((c) => c.startsWith("sl_session="));
  return { ...r, cookie: raw ? raw.split(";")[0] : undefined, setCookie: raw };
}

const db = new PrismaClient();

async function main() {
  console.log(`\nShort-link e2e against ${BASE}  (prefix ${P})\n`);

  console.log("1. Visitors cannot manage anything");
  let r = await http("/api/links");
  check("GET /api/links without session -> 401", r.status === 401, r.status);
  r = await http("/api/links", { method: "POST", json: { destination: "https://example.com", alias: `${P}-nope` } });
  check("POST /api/links without session -> 401", r.status === 401, r.status);
  r = await http("/api/links/anything", { method: "PATCH", json: { destination: "https://example.com" } });
  check("PATCH without session -> 401", r.status === 401, r.status);
  r = await http("/api/links/anything", { method: "DELETE" });
  check("DELETE without session -> 401", r.status === 401, r.status);
  r = await http(`/api/links/check?alias=${P}-x`);
  check("alias check without session -> 401", r.status === 401, r.status);
  r = await http("/admin/links");
  check("/admin/links without session redirects to login", [302, 303, 307].includes(r.status) && /\/admin\/login/.test(r.headers.get("location") ?? ""), `${r.status} ${r.headers.get("location")}`);
  r = await http("/api/links", { cookie: "sl_session=v1.forged.forged" });
  check("forged cookie -> 401", r.status === 401, r.status);
  check("nothing was created by unauthenticated writes", (await db.link.count({ where: { alias: { startsWith: P } } })) === 0);

  console.log("\n2. Sign-in");
  r = await login("definitely-wrong-password", `198.51.100.${Math.floor(Math.random() * 200) + 1}`);
  check("wrong password -> 401", r.status === 401, r.status);
  check("wrong password sets no cookie", !r.cookie);
  const session = await login(PASSWORD);
  check("right password -> 200", session.status === 200, `${session.status} ${session.text.slice(0, 120)}`);
  check("session cookie issued", !!session.cookie);
  check("cookie is HttpOnly", /httponly/i.test(session.setCookie ?? ""), session.setCookie);
  check("cookie is SameSite=Lax", /samesite=lax/i.test(session.setCookie ?? ""), session.setCookie);
  check("cookie scoped to /", /path=\//i.test(session.setCookie ?? ""));
  if (BASE.startsWith("https://") || process.env.E2E_EXPECT_SECURE === "1") {
    check("cookie is Secure", /;\s*secure/i.test(session.setCookie ?? ""), session.setCookie);
  }
  const cookie = session.cookie;
  if (!cookie) throw new Error("cannot continue without a session");

  r = await http("/admin/links", { cookie });
  check("dashboard page renders for admin", r.status === 200 && /Short links/.test(r.text), r.status);
  check("dashboard HTML does not leak secrets", !r.text.includes(PASSWORD) && !/ADMIN_SESSION_SECRET|npg_/.test(r.text));

  console.log("\n3. Request hardening");
  r = await http("/api/links", { method: "POST", cookie, origin: "https://evil.example", json: { destination: "https://example.com", alias: `${P}-csrf` } });
  check("cross-site Origin -> 403", r.status === 403, r.status);
  r = await http("/api/links", { method: "POST", cookie, origin: null, json: { destination: "https://example.com", alias: `${P}-csrf` } });
  check("missing Origin -> 403", r.status === 403, r.status);
  r = await http("/api/links", { method: "POST", cookie, raw: "destination=https://example.com", headers: { "content-type": "text/plain" } });
  check("non-JSON content type -> 415", r.status === 415, r.status);
  r = await http("/api/links", { method: "POST", cookie, raw: "{not json", headers: { "content-type": "application/json" } });
  check("malformed JSON -> 400", r.status === 400, r.status);
  check("CSRF attempts created nothing", (await db.link.count({ where: { alias: `${P}-csrf` } })) === 0);

  console.log("\n4. Create with a custom alias");
  const alias = `${P}-hotel-booking`;
  r = await http("/api/links", { method: "POST", cookie, json: { destination: BOOKING, alias } });
  check("create -> 201", r.status === 201, `${r.status} ${r.text.slice(0, 200)}`);
  const link = r.data?.link;
  check("short URL uses the configured base + alias", link?.shortUrl?.endsWith(`/${alias}`), link?.shortUrl);
  check("destination stored exactly as pasted", link?.destination === BOOKING);
  check("starts with 0 clicks", link?.clicks === 0);
  check("external destination is flagged external", link?.isExternal === true);
  if (link?.id) createdIds.push(link.id);
  const row = await db.link.findUnique({ where: { alias } });
  check("persisted in the database", row?.destination === BOOKING);

  r = await http("/api/links", { method: "POST", cookie, json: { destination: BOOKING, alias: `  ${P.toUpperCase()}-Mixed Case  ` } });
  check("alias is normalised (case + spaces)", r.status === 201 && r.data?.link?.alias === `${P}-mixed-case`, r.text.slice(0, 200));
  if (r.data?.link?.id) createdIds.push(r.data.link.id);

  console.log("\n5. Validation");
  r = await http("/api/links", { method: "POST", cookie, json: { destination: "https://example.com/other", alias } });
  check("duplicate alias -> 409", r.status === 409 && r.data?.error?.field === "alias", `${r.status} ${r.text.slice(0, 160)}`);
  r = await http("/api/links", { method: "POST", cookie, json: { destination: "https://example.com", alias: alias.toUpperCase() } });
  check("duplicate differing only by case -> 409", r.status === 409, r.status);
  for (const bad of ["bad/alias", "bad.alias", "emoji😀", "-edge", "x".repeat(65)]) {
    r = await http("/api/links", { method: "POST", cookie, json: { destination: "https://example.com", alias: bad } });
    check(`invalid alias ${JSON.stringify(bad.slice(0, 20))} -> 400`, r.status === 400 && r.data?.error?.field === "alias", r.status);
  }
  for (const reserved of ["admin", "api", "trips", "mn"]) {
    r = await http("/api/links", { method: "POST", cookie, json: { destination: "https://example.com", alias: reserved } });
    check(`reserved alias "${reserved}" -> 400`, r.status === 400, r.status);
  }
  for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd", "ftp://example.com", "www.booking.com", "", "https://user:pw@example.com", "https://exa mple.com"]) {
    r = await http("/api/links", { method: "POST", cookie, json: { destination: bad, alias: `${P}-bad` } });
    check(`invalid destination ${JSON.stringify(bad.slice(0, 28))} -> 400`, r.status === 400 && r.data?.error?.field === "destination", r.status);
  }
  check("rejected requests created nothing", (await db.link.count({ where: { alias: { in: [`${P}-bad`, "admin", "api", "trips", "mn"] } } })) === 0);

  console.log("\n6. Alias availability check");
  r = await http(`/api/links/check?alias=${alias}`, { cookie });
  check("taken alias reported unavailable", r.data?.available === false && r.data?.reason === "taken", r.text.slice(0, 120));
  r = await http(`/api/links/check?alias=${P}-free`, { cookie });
  check("free alias reported available", r.data?.available === true, r.text.slice(0, 120));
  r = await http(`/api/links/check?alias=admin`, { cookie });
  check("reserved alias reported invalid", r.data?.available === false && r.data?.reason === "invalid");

  console.log("\n7. Random aliases");
  r = await http("/api/links", { method: "POST", cookie, json: { destination: "https://example.com/random-1" } });
  check("blank alias -> random alias created", r.status === 201 && /^[a-z0-9]{7,8}$/.test(r.data?.link?.alias ?? ""), `${r.status} ${r.data?.link?.alias}`);
  if (r.data?.link?.id) createdIds.push(r.data.link.id);
  const r2 = await http("/api/links", { method: "POST", cookie, json: { destination: "https://example.com/random-2", random: true, alias: "ignored" } });
  check("random:true -> random alias created", r2.status === 201 && r2.data?.link?.alias !== "ignored", `${r2.status} ${r2.data?.link?.alias}`);
  if (r2.data?.link?.id) createdIds.push(r2.data.link.id);
  check("two random aliases differ", r.data?.link?.alias !== r2.data?.link?.alias);

  console.log("\n8. Redirects");
  r = await http(`/${alias}`);
  check("short URL -> 302", r.status === 302, r.status);
  const expectedLocation = new URL(BOOKING).href;
  check("Location equals the original destination", r.headers.get("location") === expectedLocation, r.headers.get("location"));
  const loc = new URL(r.headers.get("location") ?? "http://x");
  check("every query parameter preserved", [...new URL(BOOKING).searchParams].every(([k, v]) => loc.searchParams.get(k) === v) && loc.search === new URL(BOOKING).search);
  check("fragment preserved", loc.hash === "#hotelTmpl");
  check("redirect is not cacheable", /no-store/.test(r.headers.get("cache-control") ?? ""));
  r = await http(`/${alias.toUpperCase()}`);
  check("alias lookup is case-insensitive", r.status === 302);
  r = await http(`/${P}-does-not-exist`);
  check("unknown alias -> 404 page, NOT a redirect", r.status === 404 && !r.headers.get("location") && /doesn.t exist/i.test(r.text), r.status);
  r = await http(`/wp-login.php`);
  check("junk path -> 404", r.status === 404 && !r.headers.get("location"), r.status);

  console.log("\n9. Click counting");
  const before = await db.link.findUnique({ where: { alias } });
  await http(`/${alias}`, { method: "HEAD" });
  await http(`/${alias}`, { ua: "Mozilla/5.0 (compatible; Googlebot/2.1)" });
  await http(`/${alias}`, { headers: { "sec-purpose": "prefetch" } });
  const afterMachines = await db.link.findUnique({ where: { alias } });
  check("HEAD, bots and prefetch are not counted", afterMachines.clicks === before.clicks, `${before.clicks} -> ${afterMachines.clicks}`);
  const N = 40;
  const results = await Promise.all(Array.from({ length: N }, () => http(`/${alias}`)));
  check(`${N} concurrent visits all redirect`, results.every((x) => x.status === 302));
  const afterVisits = await db.link.findUnique({ where: { alias } });
  check(`concurrent clicks counted exactly (no lost updates)`, afterVisits.clicks === before.clicks + N, `${before.clicks} + ${N} -> ${afterVisits.clicks}`);
  check("clicks do not change updatedAt", afterVisits.updatedAt.getTime() === before.updatedAt.getTime());

  console.log("\n10. List + search");
  r = await http("/api/links", { cookie });
  const found = r.data?.links?.find((l) => l.alias === alias);
  check("list shows the link with its exact click count", found?.clicks === afterVisits.clicks, `${found?.clicks} vs ${afterVisits.clicks}`);
  check("list is newest-first", r.data?.links?.[0]?.createdAt >= r.data?.links?.[r.data.links.length - 1]?.createdAt);
  r = await http(`/api/links?q=${encodeURIComponent(alias.slice(0, 14))}`, { cookie });
  check("search by alias", r.data?.links?.some((l) => l.alias === alias));
  r = await http(`/api/links?q=${encodeURIComponent("INNER-MONGOLIA-GRAND")}`, { cookie });
  check("search by destination (case-insensitive)", r.data?.links?.some((l) => l.alias === alias));
  r = await http(`/api/links?q=${encodeURIComponent("zzzz-nothing-matches-this")}`, { cookie });
  check("search with no match -> empty list", Array.isArray(r.data?.links) && r.data.links.length === 0);

  console.log("\n11. Edit");
  const NEW = "https://example.com/new-destination?x=1&y=2";
  r = await http(`/api/links/${link.id}`, { method: "PATCH", cookie, json: { destination: NEW } });
  check("edit -> 200", r.status === 200, `${r.status} ${r.text.slice(0, 160)}`);
  check("alias unchanged after edit", r.data?.link?.alias === alias);
  check("clicks preserved after edit", r.data?.link?.clicks === afterVisits.clicks, `${r.data?.link?.clicks} vs ${afterVisits.clicks}`);
  check("updatedAt moved on edit", new Date(r.data?.link?.updatedAt) > afterVisits.updatedAt);
  r = await http(`/${alias}`);
  check("short URL now redirects to the NEW destination", r.headers.get("location") === NEW, r.headers.get("location"));
  r = await http(`/api/links/${link.id}`, { method: "PATCH", cookie, json: { destination: "javascript:alert(1)" } });
  check("edit to a bad destination -> 400", r.status === 400);
  r = await http(`/api/links/nonexistent-id`, { method: "PATCH", cookie, json: { destination: NEW } });
  check("edit of a missing link -> 404", r.status === 404, r.status);
  r = await http(`/api/links/${link.id}`, { method: "PATCH", cookie, origin: "https://evil.example", json: { destination: "https://evil.example" } });
  check("cross-site edit -> 403", r.status === 403);

  console.log("\n12. Delete");
  r = await http(`/api/links/${link.id}`, { method: "DELETE", cookie, origin: "https://evil.example" });
  check("cross-site delete -> 403", r.status === 403);
  check("link survived the blocked delete", (await db.link.count({ where: { id: link.id } })) === 1);
  r = await http(`/api/links/${link.id}`, { method: "DELETE", cookie });
  check("delete -> 200", r.status === 200, r.status);
  r = await http(`/${alias}`);
  check("deleted short URL -> 404", r.status === 404 && !r.headers.get("location"), r.status);
  r = await http(`/api/links/${link.id}`, { method: "DELETE", cookie });
  check("deleting twice -> 404", r.status === 404, r.status);
  check("gone from the database", (await db.link.count({ where: { id: link.id } })) === 0);

  console.log("\n13. Abuse protection");
  const lockXff = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  const attempts = [];
  for (let i = 0; i < 6; i++) attempts.push((await login(`wrong-${i}`, lockXff)).status);
  check("5 wrong passwords answer 401, the 6th is locked out (429)", attempts.slice(0, 5).every((s) => s === 401) && attempts[5] === 429, attempts.join(","));
  r = await login(PASSWORD, lockXff);
  check("even the RIGHT password is refused while locked out", r.status === 429, r.status);
  check("lock-out sends Retry-After", Number(r.headers.get("retry-after")) > 0);
  r = await login(PASSWORD);
  check("a different client can still sign in", r.status === 200);

  const writeXff = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
  const writeStatuses = [];
  for (let i = 0; i < 62; i++) {
    writeStatuses.push((await http("/api/links", { method: "POST", cookie, xff: writeXff, json: {} })).status);
  }
  check("write flood is throttled to 429 after 60", writeStatuses.slice(0, 60).every((s) => s === 400) && writeStatuses[60] === 429, `${writeStatuses[59]},${writeStatuses[60]},${writeStatuses[61]}`);

  console.log("\n14. Sign out");
  r = await http("/api/auth/logout", { method: "POST", cookie, json: {} });
  check("logout -> 200 and clears the cookie", r.status === 200 && /sl_session=;/.test(r.res.headers.getSetCookie().join(";")) || /max-age=0/i.test(r.res.headers.getSetCookie().join(";")));
}

try {
  await main();
} catch (error) {
  failures.push(`crashed: ${error.message}`);
  console.error(error);
} finally {
  // Clean up everything this run created, pass or fail.
  const removed = await db.link.deleteMany({ where: { alias: { startsWith: P } } });
  const removedRandom = createdIds.length ? await db.link.deleteMany({ where: { id: { in: createdIds } } }) : { count: 0 };
  await db.rateLimit.deleteMany({});
  console.log(`\ncleanup: removed ${removed.count + removedRandom.count} test link(s) and all rate-limit counters`);
  await db.$disconnect();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("Failed:\n  - " + failures.join("\n  - "));
  process.exit(1);
}
