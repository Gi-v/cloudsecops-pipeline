import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": "/src" },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // Docker Desktop's bind-mount bridge (especially on Windows/WSL2)
      // doesn't reliably forward native filesystem change events into the
      // container, so Vite's default chokidar watcher either misses edits
      // entirely or — worse — fires spurious/duplicate change events it
      // can't reconcile into a normal HMR update, and falls back to a full
      // page reload instead. Polling sidesteps native fs events entirely:
      // chokidar just re-stats watched files on an interval, which works
      // identically whether or not the mount forwards inotify events.
      usePolling: true,
      interval: 300,
    },
    hmr: {
      // Pin the client's reconnect target explicitly rather than letting
      // it infer one from window.location — inside Docker, that inference
      // can pick the container's internal port instead of the host-mapped
      // one, which manifests as exactly this symptom: the page reloads
      // itself repeatedly because the HMR websocket keeps failing to
      // reconnect and Vite's client gives up and forces a reload.
      clientPort: 5173,
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8's default bundler (Rolldown) only accepts a function here —
        // the Rollup-era object-map-of-package-names form errors at build
        // time ("manualChunks is not a function").
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react-router-dom/") || id.includes("/react/") || id.includes("/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("/chart.js/") || id.includes("/react-chartjs-2/")) {
            return "vendor-charts";
          }
          if (id.includes("/framer-motion/")) {
            return "vendor-motion";
          }
        },
      },
    },
  },
});
