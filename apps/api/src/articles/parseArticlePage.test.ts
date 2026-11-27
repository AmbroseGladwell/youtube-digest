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

const markupRecipePage = (recipe: string) =>
  `<!doctype html><html><head><title>Bean &amp; halloumi stew</title><meta property="og:type" content="article"></head><body><h1>Bean &amp; halloumi stew</h1>${recipe}</body></html>`;

const INGREDIENTS = `<div class="ingredient-list"><h3>Ingredients</h3><ul><li>3 tbsp olive oil</li><li>400g can mixed beans, drained</li><li>½ x 250g block halloumi, sliced</li></ul></div>`;

const METHOD = `<div class="method-list"><h3>Method</h3><ol><li><p>Simmer the beans in the tomatoes for 10 mins.</p></li><li><p>Fry the halloumi for 2 mins on each side until golden.</p></li></ol></div>`;

test("reads the recipe a page lays out under its headings without declaring it", () => {
  const read = parseArticlePage(markupRecipePage(INGREDIENTS + METHOD), "https://example.com/stew");
  assert.equal(read.status, "read");
  assert.deepEqual(read.status === "read" && read.article.recipe?.ingredients, [
    "3 tbsp olive oil",
    "400g can mixed beans, drained",
    "½ x 250g block halloumi, sliced",
  ]);
  assert.equal(read.status === "read" && read.article.recipe?.steps.length, 2);
});

test("a method above its ingredients is not read as a recipe", () => {
  const read = parseArticlePage(markupRecipePage(METHOD + INGREDIENTS), "https://example.com/stew");
  assert.equal(read.status === "read" ? read.article.recipe : null, null);
});

const closedParagraphs = (count: number) => Array.from({ length: count }, (_, index) => `<p>${index + 1}. ${PARAGRAPH}</p>`).join("");

const streamedPage = (swaps: string) =>
  `<!doctype html><html><head><title>The harbour wall</title><meta property="og:type" content="article"></head><body>` +
  `<!--$?--><template id="B:0"></template><main class="animate-pulse"><p>Loading the story while it streams in</p></main><!--/$-->` +
  `<div hidden id="S:0"><main><article><h1>The harbour wall</h1>${closedParagraphs(3)}` +
  `<!--$?--><template id="B:1"></template><p>Loading the rest of the story</p><!--/$-->` +
  `<template id="P:2"></template></article></main></div>` +
  `<div hidden id="S:1"><h2 id="the-storm">The storm</h2>${closedParagraphs(2)}</div>` +
  `<div hidden id="S:2"><h2 id="since">Since</h2>${closedParagraphs(1)}</div>` +
  `<script>${swaps}</script></body></html>`;

const headingsOf = (read: ReturnType<typeof parseArticlePage>) =>
  read.status === "read" ? read.article.sections.map(({ heading }) => heading) : [];

test("reads a page that streams its story in after a loading skeleton, as React renders it", () => {
  const read = parseArticlePage(streamedPage(`$RC("B:0","S:0");$RC("B:1","S:1");$RS("S:2","P:2")`), "https://example.com/wall");
  assert.equal(read.status, "read");
  assert.deepEqual(headingsOf(read), [null, "The storm", "Since"]);
  const text = read.status === "read" ? read.article.sections.map((section) => section.text).join(" ") : "";
  assert.doesNotMatch(text, /Loading/);
  assert.ok(read.status === "read" && read.article.wordCount > 150);
});

test("a streamed part the page never swaps in stays out of the read", () => {
  const read = parseArticlePage(streamedPage(`$RC("B:0","S:0")`), "https://example.com/wall");
  assert.deepEqual(headingsOf(read), [null]);
});

test("a streamed page whose swaps never arrived reads as it would in a browser with scripts off", () => {
  assert.deepEqual(parseArticlePage(streamedPage(""), "https://example.com/wall"), { status: "failed", reason: "nothing-readable" });
});
