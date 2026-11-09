import test from "node:test";
import assert from "node:assert/strict";
import { articlePlaceUrl } from "./ArticlePlace.js";

const URL = "https://a.example/post";

test("a place at a heading uses the heading's id", () => {
  assert.equal(articlePlaceUrl(URL, { anchor: "who-pays", quote: "The county" }), `${URL}#who-pays`);
});

test("a place with no id becomes a text fragment", () => {
  assert.equal(articlePlaceUrl(URL, { anchor: null, quote: "The county offered half" }), `${URL}#:~:text=The%20county%20offered%20half`);
});

test("a hyphen, comma or ampersand in the quote cannot be read as fragment syntax", () => {
  assert.equal(
    articlePlaceUrl(URL, { anchor: null, quote: "well-read, this & that" }),
    `${URL}#:~:text=well%2Dread%2C%20this%20%26%20that`,
  );
});
