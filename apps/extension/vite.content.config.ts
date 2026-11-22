import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// docs/features/injected-button.md, "Two builds, because a content script cannot be a module".
export default defineConfig({
  build: {
    target: "esnext",
    // The page build runs first and owns emptying dist/.
    emptyOutDir: false,
    lib: {
      entry: path.resolve(dirname, "src/content/contentScript.ts"),
      formats: ["iife"],
      name: "OverviewInjectedButton",
      // manifest.json names this file literally, so it can't carry a content hash.
      fileName: () => "contentScript.js",
    },
  },
});
