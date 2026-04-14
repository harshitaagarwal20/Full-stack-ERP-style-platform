# Network Connectivity Test Checklist

## ✅ Configuration Status

### Backend (.env)
```
✓ PORT: 5000
✓ DATABASE_URL: mysql://root:2Harshita2004@localhost:3306/nimbasia
✓ CLIENT_ORIGIN: http://localhost:5174,http://127.0.0.1:5174,http://192.168.1.188:5174,https://*.vercel.app
✓ Server listens on 0.0.0.0 (all interfaces)
```

### Frontend (.env)
```
✓ VITE_API_URL: http://192.168.1.188:5000/api
```

### Machine IP
```
✓ 192.168.1.188
```

---

## 📋 Test Steps

### Test 1: Backend Server Running Locally
**Command:**
```bash
cd backend && npm start
```

**Expected Output:**
```
Server running on http://0.0.0.0:5000
Access from this machine: http://localhost:5000
Access from network: http://<your-machine-ip>:5000
```

**Success Criteria:** See all three lines in console

---

### Test 2: Backend Accessible on Localhost
**Command:**
```bash
curl http://localhost:5000/api/auth/profile
```

**Expected Result:** Should get either:
- 401 Unauthorized (if not logged in) - ✓ Server is running
- 200 OK (if authenticated) - ✓ Server is running

**Failure Result:** Connection refused - ✗ Server not running or wrong port

---

### Test 3: Backend Accessible on Network IP
**Command (from same machine):**
```bash
curl http://192.168.1.188:5000/api/auth/profile
```

**Expected Result:** Same as Test 2 (401 or 200)

**Failure Result:** Connection refused or timeout - ✗ Check firewall

---

### Test 4: Frontend Running Locally
**Command:**
```bash
cd frontend && npm run dev
```

**Expected Output:**
```
VITE v5.x.x building for production
  ➜  Local:   http://localhost:5174/
  ➜  Network: http://192.168.1.188:5174/
```

**Success Criteria:** Both URLs shown, no errors

---

### Test 5: Frontend Accessible Locally
**Action:** Open browser to `http://localhost:5174`

**Expected:** 
- Application loads
- Login page appears
- No CORS errors in console

**Check console:** Press F12 → Console tab → Should be empty (no red errors)

---

### Test 6: Frontend-Backend Communication
**Action:** Try to login on `http://localhost:5174`

**Steps:**
1. Enter credentials (admin@nimbasia.com / admin)
2. Click Login
3. Watch Network tab in DevTools (F12 → Network)

**Expected:**
- POST request to `/api/auth/login` shows 200 status
- Response has authentication token
- Redirected to dashboard

**Failure:** 
- 403 Forbidden - ✗ CORS blocked
- POST pending forever - ✗ Backend not running
- ERR_CONNECTION_REFUSED - ✗ Wrong backend URL

---

### Test 7: Network Access from Another Machine
**On another laptop connected to same WiFi:**

**Step 1:** Open browser to `http://192.168.1.188:5174`

**Expected:**
- Application loads (may be slower over network)
- Login page appears
- No connection errors

**Failure Indicators:**
- Page won't load: ✗ Firewall blocking port 5174
- ERR_CONNECTION_REFUSED: ✗ Backend not accessible
- Application loads but login fails: ✓ Continue to Step 2

**Step 2:** Try to login

**Expected:**
- Same as Test 6 but over network
- May see in Network tab: XHR to `http://192.168.1.188:5000/api/auth/login`

**Failure:**
- CORS error in console: ✗ CLIENT_ORIGIN not configured correctly
- Network timeout: ✗ Firewall blocking port 5000

---

## 🔧 Troubleshooting

### Issue: "Cannot find module" error
**Solution:**
```bash
cd frontend && rm -rf node_modules .vite && npm install
npm run dev
```

### Issue: CORS error in console
**Solution:**
```bash
# Check backend CLIENT_ORIGIN setting
cat backend/.env | grep CLIENT_ORIGIN

# Must include: http://192.168.1.188:5174
# Restart backend: npm start (in backend folder)
```

### Issue: Connection timeout when accessing from other machine
**Solution:**
```bash
# Check if backend is accessible
ping 192.168.1.188

# Check if ports are open (on Windows)
netstat -an | findstr "5000"
netstat -an | findstr "5174"

# If blocked by firewall, add exceptions:
# Windows: Settings > Privacy & Security > Windows Defender Firewall > Allow through firewall
# Add: Port 5000 (backend) and Port 5174 (frontend)
```

### Issue: Backend says "listening on 0.0.0.0:5000" but can't connect
**Solution:**
1. Verify machine IP: `ipconfig | findstr "IPv4 Address"`
2. Try localhost first: `curl http://localhost:5000/api/auth/profile`
3. Check firewall is not blocking port 5000
4. Verify correct IP in frontend VITE_API_URL

---

## ✅ Final Verification Checklist

- [ ] Backend runs without errors on `npm start`
- [ ] `localhost:5000/api/` responds (even if 404/401)
- [ ] `192.168.1.188:5000/api/` responds from same machine
- [ ] Frontend runs without errors on `npm run dev`
- [ ] `localhost:5174` loads in browser
- [ ] Login works on `localhost:5174`
- [ ] Another machine can access `192.168.1.188:5174`
- [ ] Login works on other machine
- [ ] No CORS errors in browser console
- [ ] Network requests show correct backend URL in DevTools

---

## 📊 Network Topology

```
┌─────────────────────────────┐
│   WiFi Network              │
│  (192.168.1.0/24)           │
└──────────────────┬──────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
    ┌───▼──┐   ┌──▼──┐   ┌──▼──┐
    │ Dev  │   │ PC  │   │ PC  │
    │ Mach │   │  2  │   │  3  │
    │(Host)│   │     │   │     │
    └──▲───┘   └─────┘   └─────┘
       │
       ├─Backend: http://0.0.0.0:5000
       │  (listens on all interfaces)
       │
       ├─Frontend Dev: http://localhost:5174
       │  (local only, or http://192.168.1.188:5174)
       │
       └─Can be accessed from:
         ✓ http://localhost:5174
         ✓ http://127.0.0.1:5174
         ✓ http://192.168.1.188:5174
```

---

## 🚀 Quick Start for Multi-Device Testing

**Terminal 1 (Backend):**
```bash
cd backend
npm start
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

**Browser 1 (This machine):**
```
http://localhost:5174
```

**Browser 2 (Other machine on same WiFi):**
```
http://192.168.1.188:5174
```

That's it! Both should work identically.
