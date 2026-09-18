import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@overview/app-core": path.resolve(dirname, "../../packages/app-core/src/index.ts"),
    },
  },
  build: {
    target: "esnext",
    // Vite's modulepreload polyfill is an inline <script>, which MV3's extension-page CSP
    // refuses to run.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        sidepanel: path.resolve(dirname, "sidepanel.html"),
        app: path.resolve(dirname, "app.html"),
        serviceWorker: path.resolve(dirname, "src/serviceWorker.ts"),
      },
      output: {
        // manifest.json names these files literally, so they can't carry a content hash.
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
