
# Nibasia System (FMS)

Production-ready full-stack web app for workflow:

`Enquiry -> Approval -> Order -> Production -> Completion -> Dispatch`

## Tech Stack

- Frontend: React (hooks), Axios, Tailwind CSS (mobile-first responsive)
- Backend: Node.js, Express, JWT auth, RBAC middleware
- Database: MySQL + Prisma ORM

The deployed frontend is `frontend-hostinger/`. The top-level `frontend/` folder
is an older copy kept only for reference — do not develop against it.

## Folder Structure

```text
Nimbasia/
  backend/
    prisma/
      schema.prisma
      seed.js
    src/
      config/
      controllers/
      middleware/
      routes/
      services/
      utils/
      app.js
      server.js
  frontend/
    src/
      api/
      components/
      context/
      pages/
      App.jsx
      main.jsx
  docs/
    gst.md
```

## Documentation

- [`gst.py`](docs/gst.md) - GST reconciliation script guide

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

4. Update `DATABASE_URL` in `.env` for your MySQL instance.
5. Run Prisma migration and generate client:

```bash
npx prisma migrate dev --name init
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

## Deployment Notes

- Set the backend `CLIENT_ORIGIN` env var to the exact deployed frontend origin, such as `https://app.nimbasia.com`. Multiple origins can be comma-separated, and `*` wildcards are supported by the backend CORS matcher.
- Leave the frontend `VITE_API_URL` empty in production so it calls the same-origin `/api` (the backend serves the built frontend); only set it if the API is on a different origin.
- Set a strong `JWT_SECRET` (32+ chars) and a `CRON_SECRET`; the backend refuses to start in production without a strong `JWT_SECRET`.

## Bootstrap Login

- Admin: `admin@gmail.com` / `123456`

Change this password immediately after any deployment. The seed script will not
overwrite it once the account exists.

## API Modules

- `POST /api/auth/login`
- `GET/POST /api/users` (admin)
- `GET/POST /api/enquiries` (sales; admin has full override)
- `PUT /api/enquiries/:id` (admin)
- `GET/POST /api/orders` (sales create; others view by role)
- `POST /api/production`, `GET /api/production`, `PUT /api/production/:id`
- `GET /api/dispatch`, `POST /api/dispatch`

## Business Validation Rules

- Order creation is blocked unless enquiry is `ACCEPTED`.
- Cannot start production without a valid order in `CREATED` status.\n- Completion auto-updates order status to `COMPLETED`.\n- Cannot dispatch unless order status is `COMPLETED`.\n- Each dispatch is linked 1:1 with an order.\n- Dispatch tracking statuses: `PACKING`, `SHIPPED`, `DELIVERED`.
- Enquiry approval/rejection only allowed from `PENDING` state.

## UI Features

- Mobile-first responsive design (`sm`, `md`, `lg`)
- Mobile sidebar with hamburger menu
- Cards on mobile and table layout on desktop
- Status badges (`Pending`, `Approved`, `Completed`, `Rejected`)
- Toast notifications, loading spinners, error feedback
- Search and filters across modules

# Full-stack-ERP-style-platform
Full-stack logistics and ERP-style platform with a Node.js/Express backend and Vite/React frontend, built to handle order management, enquiry tracking, production workflows, dispatch control, and role-based user access in one cohesive system. It includes order lifecycle tracking, responsive admin interface for users approvals.
