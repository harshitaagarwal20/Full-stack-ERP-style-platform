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

The frontend is configured to call the Hostinger backend at:

```env
VITE_API_URL=https://manage.nimbasia.com/api
```

## Hostinger Deployment

1. Create a new Hostinger `Node.js Web App`
2. Import the frontend-only GitHub repo
3. Set the framework preset to `Vite` or `React`
4. Use package manager `npm`
5. Use build command `npm run build`
6. Set output directory to `dist`
7. Deploy
