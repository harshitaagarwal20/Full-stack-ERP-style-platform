
# Nibasia System (FMS)

Production-ready full-stack web app for workflow:

`Enquiry -> Approval -> Order -> Production -> Completion -> Dispatch`

## Tech Stack

- Frontend: React (hooks), Axios, Tailwind CSS (mobile-first responsive)
- Backend: Node.js, Express, JWT auth, RBAC middleware
- Database: PostgreSQL + Prisma ORM

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

- `admin`: full access + user management
- `sales`: can view all operational modules except Activity Log; can manage enquiries and orders
- `production`: can view all operational modules except Activity Log; can manage production
- `dispatch`: can view all operational modules except Activity Log; can manage dispatch

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

4. Update `DATABASE_URL` in `.env` for your PostgreSQL.
5. Run Prisma migration and generate client:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

6. Seed user accounts only:

```bash
npm run seed
```

The seed script clears operational demo rows and keeps only user-management seed data. Master data is initialized separately by the app.

7. Start backend:

```bash
npm run dev
```

Backend runs on `http://localhost:5000`.

## Frontend Setup

1. Open terminal in `frontend`.
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

Frontend runs on `http://localhost:5173`.

## Deployment Notes

- Set the backend `CLIENT_ORIGIN` env var to the exact deployed frontend origin, such as `https://nimbasia.vercel.app`.
- For Vercel preview deployments, `https://*.vercel.app` is supported by the backend CORS matcher.
- Set the frontend `VITE_API_URL` to your Render backend base URL in production, for example `https://your-render-backend.onrender.com/api`.

## Sample Users

- Admin: `admin@fms.com` / `Admin@123`
- Sales Lead: `sales1@fms.com` / `Sales@123`
- Sales Executive: `sales2@fms.com` / `Sales@123`
- Production: `production@fms.com` / `Prod@123`
- Dispatch: `dispatch@fms.com` / `Dispatch@123`

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
