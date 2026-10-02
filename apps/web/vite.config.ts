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
  // Maps are made for PostHog and never served: "hidden" leaves no sourceMappingURL in the
  // bundle, and the image deletes them once uploaded (docs/architecture/errors-and-logs.md, "Source maps").
  build: {
    sourcemap: "hidden",
  },
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
    proxy: Object.fromEntries(
      ["/api", "/oauth", "/.well-known/oauth-", "/mcp"].map((prefix) => [prefix, process.env.API_URL ?? "http://localhost:3000"]),
    ),
  },
});
