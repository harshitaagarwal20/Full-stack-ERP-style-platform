# Nimbasia Frontend

React + Vite frontend of the Nimbasia app. In production it is **not** deployed
separately: the root `package.json` build script builds this folder and copies
`dist/` into `backend/public`, and the Express backend serves it alongside the
`/api` routes from one origin. See [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

## Local development

```bash
npm install
npm run dev
```

Runs on `http://localhost:5174` and proxies `/api` to the backend on
`http://localhost:5001` (see `vite.config.js`).

## Build

```bash
npm run build
```

Output goes to `dist/`. To produce what production actually serves, run
`npm run build` from the repo root instead — it builds this folder and copies
the output into `backend/public`.

## API base URL

The frontend calls the backend on the **same origin**, so `VITE_API_URL` stays
`/api` in both `.env.production` and local dev (the dev server proxies it).
Only set an absolute URL if the API is hosted on a different origin.
