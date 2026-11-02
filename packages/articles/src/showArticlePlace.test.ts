import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { showArticlePlace } from "./showArticlePlace.js";

const page = (body: string) => {
  const { document } = new JSDOM(`<body>${body}</body>`).window;
  const scrolled: Element[] = [];
  Object.defineProperty(document.defaultView!.Element.prototype, "scrollIntoView", {
    value(this: Element) {
      scrolled.push(this);
    },
  });
  return { document, scrolled };
};

test("a place with a heading's id moves the page there", () => {
  const { document, scrolled } = page('<h2 id="costs">Costs</h2><p>Text</p>');
  assert.equal(showArticlePlace(document, { anchor: "costs", quote: "Costs" }), true);
  assert.equal(scrolled[0]?.id, "costs");
});

test("a place without an id is found by its opening words, across inline elements and line breaks", () => {
  const { document, scrolled } = page("<p>Before.</p><p id='hit'>The county <em>reused</em>\n a survey.</p>");
  assert.equal(showArticlePlace(document, { anchor: null, quote: "The county reused a survey" }), true);
  assert.equal(scrolled[0]?.closest("p")?.id, "hit");
});

test("an id the page has lost falls back to the words", () => {
  const { document, scrolled } = page("<p id='hit'>The words are still here.</p>");
  assert.equal(showArticlePlace(document, { anchor: "gone", quote: "The words are still" }), true);
  assert.equal(scrolled[0]?.id, "hit");
});

test("a place the page no longer holds says so and moves nothing", () => {
  const { document, scrolled } = page("<p>Rewritten.</p>");
  assert.equal(showArticlePlace(document, { anchor: null, quote: "The county reused" }), false);
  assert.equal(scrolled.length, 0);
});
