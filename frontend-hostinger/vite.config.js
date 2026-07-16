import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Every page was pulling ~18 separate chunks — each one a round trip, and
        // on a real connection the latency dominates, not the bytes. React and
        // the router go in one long-lived vendor chunk (cached across deploys),
        // the shared app code in another, so a page load is a few requests rather
        // than twenty. xlsx stays out of both: it is 429 KB and only loads when
        // someone actually exports.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("xlsx")) return "xlsx";
          if (id.includes("react-router") || id.includes("/react/") || id.includes("react-dom") || id.includes("scheduler")) {
            return "vendor-react";
          }
          return "vendor";
        }
      }
    }
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
