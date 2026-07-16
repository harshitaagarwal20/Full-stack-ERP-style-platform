# Nimbasia Frontend

This folder is a frontend-only copy of the Nimbasia app for Hostinger deployment.

## Build

```bash
npm install
npm run build
```

Build output:

- `dist`

## Production API

The frontend calls the backend on the **same origin** (the Hostinger Node app
serves both the built frontend and the `/api` backend), so `VITE_API_URL` is
left empty and requests go to the relative `/api`:

```env
VITE_API_URL=
```

## Hostinger Deployment

1. Create a new Hostinger `Node.js Web App`
2. Import the frontend-only GitHub repo
3. Set the framework preset to `Vite` or `React`
4. Use package manager `npm`
5. Use build command `npm run build`
6. Set output directory to `dist`
7. Deploy
