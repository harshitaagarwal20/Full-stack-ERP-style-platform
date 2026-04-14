# Network Setup Guide

This guide explains how to set up Nimbasia for network access across multiple machines on the same WiFi.

## Problem

When connecting from a different laptop on the same WiFi, you get a "network error" because:
1. The backend server only listens on `localhost` (not accessible from other machines)
2. The frontend tries to connect to `/api` which resolves to the frontend's own server
3. CORS is configured to only allow `localhost:5174`

## Solution

### Step 1: Find Your Machine IP Address

**Windows (PowerShell):**
```powershell
ipconfig
```
Look for "IPv4 Address" under your WiFi adapter (e.g., `192.168.1.100`)

**Mac/Linux (Terminal):**
```bash
ifconfig
```
Look for `inet` address under your WiFi interface

### Step 2: Configure Backend (.env file)

Update your `backend/.env` file:

```env
PORT=5000
DATABASE_URL="mysql://root:root@localhost:3306/nimbasia"
JWT_SECRET="change_this_to_a_strong_secret"
JWT_EXPIRES_IN="30d"
CLIENT_ORIGIN="http://localhost:5174,http://127.0.0.1:5174,http://<YOUR-IP>:5174"
```

Replace `<YOUR-IP>` with your machine's IPv4 address (e.g., `192.168.1.100`)

**Example:**
```env
CLIENT_ORIGIN="http://localhost:5174,http://127.0.0.1:5174,http://192.168.1.100:5174"
```

### Step 3: Configure Frontend (.env file - if accessing from network)

**On your main development machine:** (no changes needed, use `/api`)
```env
VITE_API_URL=/api
```

**On other laptops connecting via network:** Create `.env` file in `frontend/` directory:
```env
VITE_API_URL=http://<YOUR-MAIN-MACHINE-IP>:5000
```

Replace `<YOUR-MAIN-MACHINE-IP>` with the IP address of the machine running the backend.

**Example:**
```env
VITE_API_URL=http://192.168.1.100:5000
```

### Step 4: Restart Services

**Backend:**
```bash
npm run dev
# or
npm start
```

**Frontend (on each machine):**
```bash
npm run dev
```

You should see in the backend console:
```
Server running on http://0.0.0.0:5000
Access from this machine: http://localhost:5000
Access from network: http://<your-machine-ip>:5000
```

### Step 5: Access from Other Laptops

Open your browser on the other laptop and go to:
```
http://<YOUR-MAIN-MACHINE-IP>:5174
```

**Example:**
```
http://192.168.1.100:5174
```

## Troubleshooting

**Still getting CORS errors?**
- Make sure `CLIENT_ORIGIN` in backend `.env` includes the exact frontend URL
- Restart the backend server after changing `.env`
- Check that both machines are on the same WiFi network

**Can't connect to backend from other machine?**
- Verify the IP address is correct (try pinging: `ping 192.168.1.100`)
- Check firewall settings on the main machine to allow port 5000
- Make sure the backend is running on `0.0.0.0` (not just `localhost`)

**Frontend says "Cannot find module" after changing VITE_API_URL?**
- Delete `node_modules` and `.vite` cache
- Run `npm install` again
- Restart `npm run dev`

## Security Note

⚠️ **For development only!** 

When developing on a local network, all traffic is over HTTP. For production:
- Use HTTPS
- Configure proper authentication
- Use firewall rules to restrict access
- Never expose private network IPs in production

## Quick Reference

| Scenario | Backend Config | Frontend Config |
|----------|---|---|
| Single machine localhost | (default) | `VITE_API_URL=/api` |
| Multiple machines on network | `CLIENT_ORIGIN="http://<ip>:5174,..."`| `VITE_API_URL=http://<backend-ip>:5000` |
| Production (Vercel) | `CLIENT_ORIGIN="https://*.vercel.app"` | `VITE_API_URL=/api` (proxy via vercel.json) |
