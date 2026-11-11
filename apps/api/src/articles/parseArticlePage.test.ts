import test from "node:test";
import assert from "node:assert/strict";
import { parseArticlePage } from "./parseArticlePage.js";

const PARAGRAPH =
  "The harbour wall was finished a century after it was first drawn, by a town that had stopped believing it would ever need one, and it has held through every storm since the winter it was closed.";

const paragraphs = (count: number) => Array.from({ length: count }, (_, index) => `<p>${index + 1}. ${PARAGRAPH}`).join("");

test("reads a page that leaves out its head and body tags, as minified pages do", () => {
  const read = parseArticlePage(
    `<!doctype html><html lang=en><meta charset=utf-8><title>The harbour wall</title><h1>The harbour wall</h1>${paragraphs(4)}`,
    "https://example.com/wall",
  );
  assert.equal(read.status, "read");
  assert.equal(read.status === "read" && read.article.title, "The harbour wall");
  assert.equal(read.status === "read" && read.article.language, "en");
  assert.ok(read.status === "read" && read.article.wordCount > 100);
});

test("reads the recipe a page declares", () => {
  const recipe = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "Crispy sesame chicken",
    recipeIngredient: ["2 chicken breasts", "1 tbsp sesame seeds"],
    recipeInstructions: [
      { "@type": "HowToStep", text: "Coat the chicken." },
      { "@type": "HowToStep", text: "Fry until crisp." },
    ],
  };
  const read = parseArticlePage(
    `<!doctype html><html><head><title>Crispy sesame chicken</title><script type="application/ld+json">${JSON.stringify(recipe)}</script><script>window.ads = "<p>not this</p>";</script></head><body><h1>Crispy sesame chicken</h1>${paragraphs(2)}</body></html>`,
    "https://example.com/chicken",
  );
  assert.equal(read.status, "read");
  assert.deepEqual(read.status === "read" && read.article.recipe?.ingredients, ["2 chicken breasts", "1 tbsp sesame seeds"]);
});
