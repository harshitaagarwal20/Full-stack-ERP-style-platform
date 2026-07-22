# Deployment Guide (Hostinger)

The app deploys to Hostinger as a **single Node.js web app** at `app.nimbasia.com`,
connected to GitHub with auto-deploy from `main`.

- Startup file: `server.js` (root) — it just imports `backend/src/server.js`
- Root directory: `./`
- The root `package.json` `postinstall`/`build` scripts install both packages,
  build `frontend-hostinger`, and copy the `dist` output into `backend/public`
  (`scripts/copy-frontend-dist.js`)
- Express serves the built frontend from `backend/public` and the API at `/api`
  — **one origin serves both**, so the frontend's `VITE_API_URL` stays `/api`

> The repo has two git remotes. Deploys come from `origin`
> (Full-stack-ERP-style-platform). Do **not** push backend code to the public
> `frontend-nimbasia` remote.

## Environment variables (Hostinger panel)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Plain `mysql://` URL. URL-encode any special characters in the password — an unencoded `@` breaks parsing. |
| `JWT_SECRET` | 32+ chars; the backend refuses to start in production without it. |
| `CRON_SECRET` | Required for scheduled endpoints. |
| `CLIENT_ORIGIN` | Comma-separated allowed origins; `*` wildcards supported. Must include the deployed origin, e.g. `https://app.nimbasia.com`. |
| `NODE_ENV` | `production` |

## Database setup

Hostinger MySQL is a **remote** server, not localhost. Under
**Databases → Remote MySQL**, allow host `%` for the DB user — without this every
connection is rejected with "Authentication failed", and the app returns 503s.

SQL scripts in `backend/prisma/` (these three are the only `.sql` files allowed
in the repo — `.gitignore` blocks all others so database dumps with real
customer data are never committed):

| Script | Purpose |
|---|---|
| `hostinger-init.sql` | Full current schema. Safe to run on both a fresh and a live database (additive). |
| `hostinger-additive-migration.sql` | Adds columns/tables an old backup lacks (`passwordChangedAt`, `RolePermission`, 6-value role enum). |
| `hostinger-fix-zero-dates.sql` | Repairs `0000-00-00 00:00:00` datetimes left by old backups. Idempotent; covers every datetime column. |

**Restoring from an old backup:** run `hostinger-init.sql`, then import the
data-only INSERTs (dependency-ordered, FK checks off / parent tables first),
then `hostinger-additive-migration.sql`, then `hostinger-fix-zero-dates.sql`.

## Why the Prisma setup looks the way it does

Do not "simplify" these away — each one fixed a production outage:

- **Rust-free Prisma client.** Hostinger's shared runtime CPU-throttles the
  native Rust query engine, whose timer thread then starves and panics
  (`PANIC: timer has gone away`), taking the app down intermittently. The fix is
  structural: `generator client { engineType = "client" }` in `schema.prisma`
  plus the `@prisma/adapter-mariadb` driver adapter (built from `DATABASE_URL`
  in `backend/src/config/prisma.js`). Queries compile in-process (WASM) and run
  through the `mariadb` driver — there is no native engine process to panic.
  Pinning Prisma versions only reduced the panic; the adapter eliminates it.
- **Zero dates crash the mariadb adapter.** The adapter calls
  `new Date(value).toISOString()` on every DATETIME column; `0000-00-00` values
  throw `RangeError: Invalid time value` (login 500s). This cannot be
  intercepted at the driver level — repair the data with
  `hostinger-fix-zero-dates.sql`.
- **`app.set("trust proxy", 1)`** in the backend — Hostinger's reverse proxy
  sets `X-Forwarded-For`; without this, express-rate-limit throws.
- **Port binds before DB init** so the platform health check passes while the
  database connection is still coming up.

## Diagnostics

- `GET /api/health` — liveness.
- `GET /api/health/mysql` — connects via the raw mysql2 driver (bypasses
  Prisma) and returns the real database error. Use it to tell DB problems from
  Prisma problems.

## Troubleshooting quick reference

| Symptom | Likely cause |
|---|---|
| 503s, `/api/health/mysql` says "Authentication failed" | Remote MySQL host not allowed — add `%` for the DB user |
| 503s, DB URL parse errors | Unencoded special character in the `DATABASE_URL` password |
| Intermittent crashes, `PANIC: timer has gone away` in logs | Native Prisma engine reintroduced — restore `engineType = "client"` + mariadb adapter |
| Login 500s with `RangeError: Invalid time value` | Zero dates in the data — run `hostinger-fix-zero-dates.sql` |
| `express-rate-limit` X-Forwarded-For error | `trust proxy` setting removed |
| CORS errors in the browser | Deployed origin missing from `CLIENT_ORIGIN` |
