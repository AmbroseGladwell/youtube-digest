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
});
