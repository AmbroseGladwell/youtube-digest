import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Its own bundle, so Readability reaches a page only when a reader asks for that page and
// never loads with the injected button (docs/features/article-extraction.md).
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
