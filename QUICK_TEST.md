# 🚀 Quick Test Guide - Network Access

## Your Machine IP: 192.168.1.188

---

## ⚡ 2-Minute Quick Test

### Step 1: Start Backend (Terminal 1)
```bash
cd backend && npm start
```
✅ Should show: `Server running on http://0.0.0.0:5000`

### Step 2: Start Frontend (Terminal 2)
```bash
cd frontend && npm run dev
```
✅ Should show: `Network: http://192.168.1.188:5174`

### Step 3: Test Locally
Open browser: `http://localhost:5174`
✅ App should load without errors

### Step 4: Test from Other Machine
On another laptop connected to same WiFi:
```
http://192.168.1.188:5174
```
✅ App should load and work identically

---

## ✅ Configuration Summary

| Component | URL | Status |
|-----------|-----|--------|
| Backend Server | http://192.168.1.188:5000 | ✅ Running (0.0.0.0:5000) |
| Frontend Local | http://localhost:5174 | ✅ Ready |
| Frontend Network | http://192.168.1.188:5174 | ✅ Configured |
| CORS Origins | Configured for all 3 | ✅ Active |
| Database | nimbasia (MySQL) | ✅ Connected |

---

## 🧪 Expected Test Results

| Test | Expected | Result |
|------|----------|--------|
| `http://localhost:5174` | Loads, no errors | Expected |
| `http://192.168.1.188:5174` from same machine | Loads, no errors | Expected |
| `http://192.168.1.188:5174` from other machine | Loads, no errors | Expected |
| Login on network IP | Works perfectly | Expected |
| No CORS errors | Clean console | Expected |

---

## ❌ If Something Fails

### "Can't reach server"
```bash
# Check if backend is running
curl http://localhost:5000/api/auth/profile
# Should return status 401 (auth required) = working!
```

### "CORS error in console"
```bash
# Verify backend .env
cat backend/.env
# Must include: http://192.168.1.188:5174
# Then restart backend: npm start
```

### "Can't connect from other machine"
```bash
# Check firewall - allow ports 5000 and 5174
# Windows: Settings > Windows Defender Firewall > Inbound Rules
# Or manually test access:
ping 192.168.1.188
```

---

## 📝 Configuration Files

✅ **backend/.env**
```
CLIENT_ORIGIN="http://localhost:5174,http://127.0.0.1:5174,http://192.168.1.188:5174,https://*.vercel.app"
```

✅ **frontend/.env**
```
VITE_API_URL=http://192.168.1.188:5000/api
```

✅ **backend/src/server.js**
```
Listen on: 0.0.0.0:5000 (all interfaces)
```

---

## 📚 Full Guides

- `NETWORK_SETUP.md` - Complete setup guide
- `TEST_NETWORK.md` - Detailed test checklist  
- `CONFIG_VERIFICATION_REPORT.md` - Configuration verification report

---

## 🎯 Main Test: Network Access from Another Machine

1. Start both services (steps above)
2. Other machine on same WiFi
3. Open: `http://192.168.1.188:5174`
4. Try login
5. Check Network tab (F12) for requests to `http://192.168.1.188:5000/api/`

✅ If all works = Network configuration complete!

---

**Last Updated:** April 13, 2026  
**Status:** Ready for testing ✅
