# Short links for uudamtravel.mn

Your own Bitly. Paste a long URL, choose an alias, and get `https://uudamtravel.mn/<alias>`.

```
https://uudamtravel.mn/hotel-booking  ──302──▶  https://www.booking.com/hotel/cn/…?aid=…&checkin=…
```

## Current deployment

| | |
| --- | --- |
| Dashboard | `https://short-link-ruddy.vercel.app/admin/login` |
| Vercel project | `short-link` (team `tuvshinsaihans-projects`), auto-deploys on push to `main` |
| Database | Neon project `ep-proud-shadow-b5p648j9` (`neondb`), schema applied by `prisma migrate deploy` at build |
| Website hook | `uudam-booking-web` has `SHORTLINK_ORIGIN=https://short-link-ruddy.vercel.app` set in Production |
| Secrets | Local: `.env.local` (git-ignored). Vercel: stored as sensitive variables. |

## How it fits together

```
visitor ─▶ uudamtravel.mn/hotel-booking
              │  (website: src/proxy.ts → src/lib/shortLink.ts, only when SHORTLINK_ORIGIN is set)
              ▼
          short-link app  ──▶  Neon Postgres  (links + click counts)
              │                     ▲
              │ 302 + Location      │ create / edit / delete / search
              ▼                     │
          original URL         /admin/links  (you, signed in)
```

- **This repo** (`short-link`) is its own small Next.js app: dashboard, redirect handler, database. It has its own
  Neon database and Vercel project, so it can never break the travel website.
- **The website** (`uudam-booking-web`) gets one tiny, fail-safe hook that asks this app "is `/<alias>` yours?" for
  single-word paths that aren't website pages, and passes the redirect through. If this app is off, down, or slow, the
  website behaves exactly as it did before.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 6 · Postgres (Neon) · Vercel. No paid services.

## Run it locally

```bash
npm install
cp .env.example .env.local     # then fill it in (see below)
npm run db:deploy:local        # applies migrations to the database in .env.local
npm run dev                    # http://localhost:3600/admin/links
```

## Environment variables

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon **pooled** connection string (host contains `-pooler`). Used by the running app. |
| `DIRECT_URL` | yes | Same string **without** `-pooler`. Used only for migrations. |
| `ADMIN_PASSWORD` | yes | Password for `/admin/login`. |
| `ADMIN_SESSION_SECRET` | yes | ≥ 32 random characters; signs the session cookie. |
| `SHORT_LINK_BASE_URL` | yes | `https://uudamtravel.mn` — what short URLs are displayed under. |
| `OWN_HOSTS` | no | Extra hostnames treated as "your own site" (comma-separated). |
| `BLOCKED_DESTINATION_HOSTS` | no | Hostnames nobody may shorten (comma-separated). |

If `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` are missing, sign-in is disabled and says so — it never falls back to a default.

## Database & migrations

One migration (`prisma/migrations/20261010000000_init`) creates two tables: `Link` and `RateLimit`. It is
additive only — it never drops or resets anything.

- **Alias uniqueness** is a database unique index, so two simultaneous requests can't both win an alias.
- **CHECK constraints** also guard the alias format, destination scheme/length, and non-negative clicks.
- **Clicks** are incremented with one atomic `UPDATE … SET clicks = clicks + 1`, so concurrent visitors never lose counts.

Apply migrations:

```bash
npm run db:deploy:local   # locally, reading .env.local
npm run db:status         # "Database schema is up to date!" when applied
```

On Vercel this happens automatically: the `vercel-build` script runs `prisma migrate deploy` before `next build`.

## Deploy to Vercel (free)

1. **Push** this repo to GitHub (`Tuvshee555/short-link`).
2. **Vercel → Add New → Project →** import `short-link`. Framework is detected as Next.js; leave the build settings alone
   (it uses the `vercel-build` script).
3. **Environment Variables** (Production, and Preview if you want previews to work): `DATABASE_URL`, `DIRECT_URL`,
   `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SHORT_LINK_BASE_URL=https://uudamtravel.mn`.
4. **Deploy.** Open `https://<your-project>.vercel.app/admin/links` and sign in.
5. Create a test link and visit `https://<your-project>.vercel.app/<alias>` — it should redirect. At this point links
   already work on the Vercel address.

### Make `uudamtravel.mn/<alias>` work (the website hook)

This is the only change that touches the live website, and it is **off until you switch it on**.

1. In the website repo `uudam-booking-web`, merge the branch `feat/short-link-proxy` (adds `src/lib/shortLink.ts` and a
   3-line call in `src/proxy.ts`).
2. In the website's Vercel project add the env var `SHORTLINK_ORIGIN=https://<your-project>.vercel.app` and redeploy.
3. Verify (see below).

**Impact:** for requests with no language prefix and a single word after the slash that isn't one of the site's own
pages (e.g. `/hotel-booking`), the website makes one server-side call to this app (2.5 s timeout). Anything that isn't an
alias — or any failure — falls through to the old behaviour (`/hotel-booking` → `/mn/hotel-booking`). Unset the env var
to turn the hook off completely. No DNS changes are involved.

**To roll back:** remove `SHORTLINK_ORIGIN` from the website's Vercel env vars and redeploy.

### Optional: put the dashboard on your own subdomain

The dashboard works at the Vercel address. If you'd rather use `links.uudamtravel.mn/admin/links`, add that domain to
the `short-link` Vercel project and create the CNAME record Vercel shows you. This is a DNS change, so it's up to you.

## Using the dashboard

- **Create:** paste the destination, type an alias (or press **Random**, or leave it blank), press **Create Short Link**.
  The alias is checked live; the finished URL appears with **Copy** and **Open** buttons.
- **Edit:** the pencil changes where a link points. The alias never changes, so every place you've shared it keeps working.
- **Delete:** the bin, after a confirmation.
- **Search:** filters by alias or destination. **Refresh** reloads click counts.
- Destinations show an **External** or **Your site** badge so you can tell at a glance.

Aliases: letters `a–z`, numbers, `-` and `_`, 1–64 characters, case-insensitive (`Hotel-Booking` = `hotel-booking`).
Names the website itself uses (`trips`, `about`, `mn`, `admin`, anything starting `api`, `images`, `public`, …) are
reserved — see `src/lib/reserved.ts`. **If you add a new top-level page to the website, add its name there and to
`SKIP` in the website's `src/lib/shortLink.ts`.**

## Verify a deployment

```bash
# 1. The short link redirects, query string intact:
curl -sI https://uudamtravel.mn/hotel-booking | grep -iE "^(HTTP|location)"
#    HTTP/2 302
#    location: https://www.booking.com/hotel/cn/…?aid=…&checkin=…

# 2. A made-up alias is NOT redirected to something unrelated:
curl -sI https://uudamtravel.mn/definitely-not-a-link | grep -iE "^(HTTP|location)"
#    HTTP/2 307   location: /mn/definitely-not-a-link   (the website's normal not-found)

# 3. Dashboard is private:
curl -s -o /dev/null -w "%{http_code}\n" https://<your-project>.vercel.app/api/links     # 401
```

There is also a full automated check that runs against any running instance and its real database (creates and
removes its own `zz-e2e-…` links):

```bash
npm run build && npm start      # terminal 1
npm run e2e                     # terminal 2  (E2E_BASE_URL=https://… to test a deployment)
```

## Security notes

- **Auth:** one admin. Password from `ADMIN_PASSWORD`, compared in constant time. Session = HMAC-signed, `HttpOnly`,
  `SameSite=Lax`, `Secure` in production, 7-day expiry, and bound to the password (changing it signs everyone out).
- **Every admin operation is re-checked on the server** (`requireAdmin` / `requireAdminWrite`); hiding the UI is not the
  protection. Writes also require a same-origin `Origin`, a JSON body, and pass a rate limit.
- **Rate limits** live in Postgres, so they hold across serverless instances: 5 wrong passwords → 15-minute lock-out per
  client; 60 changes/minute. Keys are salted hashes — **IP addresses are never stored**.
- **Click counting** stores only a number. No IP, no user-agent, no referrer. HEAD requests, prefetches and obvious bots
  aren't counted.
- **Destinations:** only `http://` / `https://`. `javascript:`, `data:`, `file:` etc. are rejected, as are URLs with an
  embedded `user:pass@` (a phishing disguise) and links that point at another short link on your own domain (loops).
- **Redirects are 302 and `no-store`**, so edits and deletions take effect immediately and are never cached.
- If the database is down, a short link shows a 503 page — it never guesses a destination.

### Adding abuse controls later

URL shorteners get abused for phishing, so the seams are already there:
`validateDestination()` in `src/lib/destination.ts` is the single choke point for every destination (create **and**
edit) and already accepts a `blockedHosts` list (`BLOCKED_DESTINATION_HOSTS`). A reputation check (e.g. Google Safe
Browsing) would slot in next to it. `requireAdminWrite()` in `src/lib/http.ts` is the single choke point for rate limits.
Public visitors can't create links at all.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Build fails at `prisma migrate deploy` | `DIRECT_URL` missing or wrong in Vercel. It must be the non-pooler string. |
| `Can't reach database server` | Check `DATABASE_URL`. Neon free databases sleep; the first request after idle can take a few seconds. |
| Login page says sign-in isn't set up | `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` (≥ 32 chars) missing in this environment. Redeploy after adding. |
| "Too many wrong passwords" | Wait 15 minutes, or delete the rows in the `RateLimit` table. |
| Login works but you're sent back to login | The cookie is `Secure` in production — open the site over `https://`. |
| `uudamtravel.mn/<alias>` shows the website's 404 | The website's `SHORTLINK_ORIGIN` isn't set / has a typo, or the alias doesn't exist. Test `https://<project>.vercel.app/<alias>` directly first. |
| Alias refused as "reserved" | It matches a website page or a reserved prefix (`api…`, `images…`, `public…`, `favicon…`). Pick another. |
| Click count didn't go up | By design: HEAD requests, prefetches and bots aren't counted. Use a normal browser visit. |
| `npm audit` shows `deepmerge-ts` | It's inside the Prisma CLI's config loader (build-time only), not reachable at runtime. |

## Scripts

`dev` · `build` · `start` · `lint` · `typecheck` · `test` (unit tests) · `e2e` (live end-to-end) ·
`db:deploy:local` · `db:status` · `db:migrate` (create a new migration) · `db:studio`
