# Nimbasia System (FMS)

Full-stack ERP-style platform for the workflow:

`Enquiry -> Approval -> Order -> Production -> Completion -> Dispatch`

It covers order lifecycle tracking, enquiry management, production batches, dispatch control, purchase orders, GRNs, inventory, and role-based user access in one system.

## Tech Stack

- Frontend: React 18 (hooks), Axios, Tailwind CSS (mobile-first responsive), Vite
- Backend: Node.js, Express, JWT auth, RBAC middleware
- Database: MySQL + Prisma ORM 6 (Rust-free `engineType = "client"` with the `@prisma/adapter-mariadb` driver adapter — no native query engine process)

The frontend lives in `frontend-hostinger/`.

## Folder Structure

```text
Nimbasia/
  server.js            # Hostinger startup file — imports backend/src/server.js
  package.json         # root build/start scripts for the single-app deployment
  backend/
    prisma/
      schema.prisma
      seed.js
      hostinger-init.sql               # full current schema (fresh or live DB safe)
      hostinger-additive-migration.sql # adds columns/tables missing from old backups
      hostinger-fix-zero-dates.sql     # repairs 0000-00-00 datetimes (see DEPLOYMENT.md)
    public/            # built frontend copied here; served by Express in production
    src/
      config/
      controllers/
      middleware/
      routes/
      services/
      utils/
      app.js
      server.js
  frontend-hostinger/
    src/
      api/
      components/
      context/
      pages/
      App.jsx
      main.jsx
  docs/
    Nimbasia_Complete_Documentation.docx
    Nimbasia_Complete_Documentation.html
```

## Documentation

- [`DEPLOYMENT.md`](DEPLOYMENT.md) — Hostinger deployment guide and troubleshooting runbook
- [`docs/Nimbasia_Complete_Documentation.html`](docs/Nimbasia_Complete_Documentation.html) — full product documentation
- [`frontend-hostinger/README.md`](frontend-hostinger/README.md) — frontend build notes

## RBAC

Roles implemented:

- `admin`: full access + user management (bypasses every role check)
- `sales`: dashboard, enquiries, approvals, orders, manual order requests
- `production`: production batches, batch cards, QC sheets, packing; raises purchase orders (without pricing); reads inventory and can post stock adjustments
- `dispatch`: dispatch dashboard, dispatch-date queue, packing
- `purchase`: raises purchase orders (supplier, items, quantities) but never sees or sets pricing and cannot release a PO; read-only GRNs and inventory
- `accounts`: owns PO pricing (unit price, tax, currency, discount, freight) and releases the priced PO to the supplier; read-only GRNs and inventory

## Backend Setup

1. Open terminal in `backend`.
2. Install dependencies:

```bash
npm install
```

3. Create env file:

```bash
cp .env.example .env
```

4. Update `DATABASE_URL` in `.env` for your MySQL instance. Do not put unencoded special characters (`@`, `#`, …) in the password — they break URL parsing.
5. Run Prisma migrations and generate the client:

```bash
npx prisma migrate dev
npx prisma generate
```

6. Ensure the bootstrap accounts exist:

```bash
npm run seed
```

`npm run seed` only creates the bootstrap accounts if they are missing — it never
touches existing users or operational data.

To also wipe operational data (enquiries, orders, productions, dispatches, manual
requests and the audit log) and restore the known bootstrap passwords, use the
development-only reset. It refuses to run when `NODE_ENV=production`:

```bash
node prisma/seed.js --reset
```

7. Start backend:

```bash
npm run dev
```

Backend runs on `http://localhost:5001` (override with `PORT`).

## Frontend Setup

1. Open terminal in `frontend-hostinger`.
2. Install dependencies:

```bash
npm install
```

3. Create env file:

```bash
cp .env.example .env
```

4. Start frontend:

```bash
npm run dev
```

Frontend runs on `http://localhost:5174` and proxies `/api` to `http://localhost:5001`.

## Deployment

The app deploys to Hostinger as a **single Node.js web app**: Express serves both
the built frontend (from `backend/public`) and the API at `/api` from one origin.
See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full guide, required env vars, the
database SQL scripts, and the troubleshooting runbook (503s, Prisma engine
panics, zero-date crashes).

Key points:

- Set the backend `CLIENT_ORIGIN` env var to the exact deployed frontend origin, such as `https://app.nimbasia.com`. Multiple origins can be comma-separated, and `*` wildcards are supported by the backend CORS matcher.
- Leave the frontend `VITE_API_URL` as `/api` in production so it calls the same origin; only set an absolute URL if the API is on a different origin.
- Set a strong `JWT_SECRET` (32+ chars) and a `CRON_SECRET`; the backend refuses to start in production without a strong `JWT_SECRET`.

## Bootstrap Login

- Admin: `admin@gmail.com` / `123456`

(The seed also creates `sales@`, `production@` and `dispatch@gmail.com` accounts
with the same password if they are missing.)

Change these passwords immediately after any deployment. The seed script will not
overwrite a password once the account exists.

## API Modules

Routes are mounted under `/api`:

- `auth` — login, profile
- `users`, `roles` — user management and role permissions (admin)
- `enquiries` — enquiry CRUD and approval (sales; admin override)
- `orders`, `manual-orders` — order lifecycle and manual order requests
- `production`, `packing` — production batches, batch cards, QC, packing
- `dispatch` — dispatch queue and shipments
- `purchase-orders`, `grns`, `inventory`, `bom` — procurement and stock
- `customers`, `master-data`, `dashboard`, `diagnostics` — supporting data and metrics
- `GET /api/health` — liveness; `GET /api/health/mysql` tests the DB via the
  mysql2 driver (bypassing Prisma) and returns the real error, to isolate
  DB-vs-Prisma problems

## Business Validation Rules

- Order creation is blocked unless enquiry is `ACCEPTED`.
- Cannot start production without a valid order in `CREATED` status.
- Completion auto-updates order status to `COMPLETED`.
- Cannot dispatch unless order status is `COMPLETED`.
- Each dispatch is linked 1:1 with an order.
- Dispatch tracking statuses: `PACKING`, `SHIPPED`, `DELIVERED`.
- Enquiry approval/rejection only allowed from `PENDING` state.

## UI Features

- Mobile-first responsive design (`sm`, `md`, `lg`)
- Mobile sidebar with hamburger menu
- Cards on mobile and table layout on desktop
- Status badges (`Pending`, `Approved`, `Completed`, `Rejected`)
- Toast notifications, loading spinners, error feedback
- Search and filters across modules
