import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Its own bundle, so Readability reaches only a page the reader asks for, never with the button.
export default defineConfig({
  build: {
    target: "esnext",
    emptyOutDir: false,
    lib: {
      entry: path.resolve(dirname, "src/content/articleReader.ts"),
      formats: ["iife"],
      name: "OverviewArticleReader",
      fileName: () => "articleReader.js",
    },
  },
});
