import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { buildStamp } from "../../scripts/buildStamp.mjs";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const stamp = buildStamp();

// The manifest is emitted rather than copied from public/, so its version is the root
// package.json's and nothing else; build.json beside it is what the release check reads
// back out of the zip (docs/architecture/deploy.md, "The version", "Tags and releases").
function stampedManifest(): Plugin {
  const asJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  return {
    name: "overview:stamped-manifest",
    generateBundle() {
      const manifest = JSON.parse(readFileSync(path.resolve(dirname, "manifest.json"), "utf8"));
      this.emitFile({ type: "asset", fileName: "manifest.json", source: asJson({ ...manifest, version: stamp.version }) });
      this.emitFile({ type: "asset", fileName: "build.json", source: asJson(stamp) });
    },
  };
}

export default defineConfig({
  plugins: [react(), stampedManifest()],
  define: {
    __BUILD_STAMP__: JSON.stringify(stamp),
  },
  resolve: {
    alias: {
      "@overview/app-core": path.resolve(dirname, "../../packages/app-core/src/index.ts"),
    },
  },
  build: {
    target: "esnext",
    // Uploaded to PostHog and deleted before the zip, never shipped (scripts/uploadSourceMaps.mjs).
    sourcemap: "hidden",
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
