import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // app-core is TSX source, not a build step apps/web should have to run first —
      // Vite transpiles it directly, the same way it does this app's own src/.
      "@overview/app-core": path.resolve(dirname, "../../packages/app-core/src/index.ts"),
    },
  },
  // In production the API serves this SPA from one origin (docs/architecture/v1-architecture-decisions.md);
  // in dev the proxy stands in for that, so the sync client can talk to the API at this
  // page's own origin and the API needs no CORS.
  server: {
    proxy: {
      "/api": process.env.API_URL ?? "http://localhost:3000",
    },
  },
});
