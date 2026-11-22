import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { buildStamp } from "../../scripts/buildStamp.mjs";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp()),
  },
  // Never served: docs/architecture/errors-and-logs.md, "Source maps".
  build: {
    sourcemap: "hidden",
  },
  resolve: {
    alias: {
      "@overview/app-core": path.resolve(dirname, "../../packages/app-core/src/index.ts"),
    },
  },
  // In dev the proxy stands in for the API serving this SPA from one origin, so the API needs no CORS.
  server: {
    proxy: Object.fromEntries(
      ["/api", "/oauth", "/.well-known/oauth-", "/mcp"].map((prefix) => [prefix, process.env.API_URL ?? "http://localhost:3000"]),
    ),
  },
});
