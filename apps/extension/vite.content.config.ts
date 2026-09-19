import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// A second build, because a content script cannot be an ES module and the rest of this
// extension is one. Everything it needs is in the bundle, so the output is a classic
// script with nothing to import (docs/features/injected-button.md).
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
