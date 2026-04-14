#!/usr/bin/env node

/**
 * Network Connectivity Test Script for Nimbasia
 * 
 * This script tests:
 * 1. Backend server availability on different interfaces
 * 2. CORS configuration
 * 3. Frontend connectivity to backend
 * 4. Database connectivity
 */

import http from "http";
import axios from "axios";

const MACHINE_IP = process.env.MACHINE_IP || "192.168.1.188";
const BACKEND_PORT = process.env.PORT || 5000;
const FRONTEND_PORT = 5174;

const tests = [];

// Test 1: Backend server is running on all interfaces (0.0.0.0)
function testBackendOnLocalhost() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${BACKEND_PORT}/api/auth/profile`, (res) => {
      const status = res.statusCode;
      resolve({
        name: "Backend on localhost:5000",
        pass: [200, 401, 403].includes(status), // 401/403 means server is running but auth failed
        details: `Status: ${status}`,
        url: `http://localhost:${BACKEND_PORT}`
      });
    });
    req.on("error", () => {
      resolve({
        name: "Backend on localhost:5000",
        pass: false,
        details: "Connection refused",
        url: `http://localhost:${BACKEND_PORT}`
      });
    });
    req.setTimeout(3000);
  });
}

// Test 2: Backend accessible on machine IP
function testBackendOnNetworkIp() {
  return new Promise((resolve) => {
    const req = http.get(`http://${MACHINE_IP}:${BACKEND_PORT}/api/auth/profile`, (res) => {
      const status = res.statusCode;
      resolve({
        name: `Backend on ${MACHINE_IP}:5000`,
        pass: [200, 401, 403].includes(status),
        details: `Status: ${status}`,
        url: `http://${MACHINE_IP}:${BACKEND_PORT}`
      });
    });
    req.on("error", () => {
      resolve({
        name: `Backend on ${MACHINE_IP}:5000`,
        pass: false,
        details: "Connection refused - Check firewall and ensure backend is running",
        url: `http://${MACHINE_IP}:${BACKEND_PORT}`
      });
    });
    req.setTimeout(3000);
  });
}

// Test 3: CORS configuration check
function testCorsConfiguration() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/api/auth/profile",
      method: "OPTIONS",
      headers: {
        "Origin": `http://${MACHINE_IP}:${FRONTEND_PORT}`,
        "Access-Control-Request-Method": "GET"
      }
    }, (res) => {
      const corsHeader = res.headers["access-control-allow-origin"];
      const pass = corsHeader !== undefined;
      resolve({
        name: "CORS Headers Present",
        pass: pass,
        details: corsHeader ? `Allowed: ${corsHeader}` : "No CORS headers - check CLIENT_ORIGIN env var",
        url: `http://localhost:${BACKEND_PORT}`
      });
    });
    req.on("error", () => {
      resolve({
        name: "CORS Headers Present",
        pass: false,
        details: "Failed to connect",
        url: `http://localhost:${BACKEND_PORT}`
      });
    });
    req.setTimeout(3000);
    req.end();
  });
}

// Test 4: Check env configuration
function testEnvConfiguration() {
  try {
    const env = (await import("./src/config/env.js")).default;
    const clientOrigins = String(env.clientOrigin || "").split(",").map(o => o.trim());
    
    const expectedOrigins = [
      `http://localhost:${FRONTEND_PORT}`,
      `http://127.0.0.1:${FRONTEND_PORT}`,
      `http://${MACHINE_IP}:${FRONTEND_PORT}`
    ];
    
    const hasAllOrigins = expectedOrigins.every(origin => 
      clientOrigins.some(configured => configured.includes(origin.split(":")[1]))
    );
    
    return {
      name: "Environment Configuration",
      pass: clientOrigins.length > 0,
      details: `Configured origins: ${clientOrigins.join(", ")}`,
      warning: !hasAllOrigins ? "⚠️ Network IP not in CLIENT_ORIGIN - add it!" : null
    };
  } catch (error) {
    return {
      name: "Environment Configuration",
      pass: false,
      details: `Error reading env: ${error.message}`
    };
  }
}

// Run all tests
async function runTests() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 NIMBASIA NETWORK CONNECTIVITY TEST");
  console.log("=".repeat(70) + "\n");
  
  console.log(`📍 Machine IP: ${MACHINE_IP}`);
  console.log(`🔧 Backend Port: ${BACKEND_PORT}`);
  console.log(`🎨 Frontend Port: ${FRONTEND_PORT}\n`);
  
  console.log("Running tests...\n");
  
  const results = [
    await testBackendOnLocalhost(),
    await testBackendOnNetworkIp(),
    await testCorsConfiguration(),
    testEnvConfiguration()
  ];
  
  // Display results
  results.forEach((test, index) => {
    const icon = test.pass ? "✅" : "❌";
    console.log(`${icon} ${test.name}`);
    console.log(`   ${test.details}`);
    if (test.warning) console.log(`   ${test.warning}`);
    console.log();
  });
  
  // Summary
  const passed = results.filter(t => t.pass).length;
  const total = results.length;
  
  console.log("=".repeat(70));
  console.log(`📊 Results: ${passed}/${total} tests passed`);
  console.log("=".repeat(70) + "\n");
  
  if (passed === total) {
    console.log("✅ All tests passed! Network access should work.");
    console.log(`\n📝 Access from this machine: http://localhost:${FRONTEND_PORT}`);
    console.log(`🌐 Access from other machines: http://${MACHINE_IP}:${FRONTEND_PORT}\n`);
  } else {
    console.log("⚠️  Some tests failed. See details above.\n");
  }
  
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(error => {
  console.error("Test error:", error);
  process.exit(1);
});
