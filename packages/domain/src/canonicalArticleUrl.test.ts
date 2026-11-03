import test from "node:test";
import assert from "node:assert/strict";
import { canonicalArticleUrl } from "./canonicalArticleUrl.js";

test("tracking parameters and the fragment go, and parameters that choose the page stay", () => {
  assert.equal(
    canonicalArticleUrl("https://a.example/post?id=7&utm_source=x&UTM_Medium=y&fbclid=z&gclid=q#comments", null),
    "https://a.example/post?id=7",
  );
});

test("a declared canonical wins, and may be relative", () => {
  assert.equal(canonicalArticleUrl("https://a.example/amp/post", "https://a.example/post"), "https://a.example/post");
  assert.equal(canonicalArticleUrl("https://a.example/amp/post", "/post"), "https://a.example/post");
});

test("a canonical on another site is kept: it is where a syndicated piece really lives", () => {
  assert.equal(canonicalArticleUrl("https://a.example/copy", "https://b.example/original"), "https://b.example/original");
});

test("a canonical pointing an article at the home page is ignored", () => {
  assert.equal(canonicalArticleUrl("https://a.example/post", "https://a.example/"), "https://a.example/post");
});

test("a canonical that is not a web address is ignored", () => {
  assert.equal(canonicalArticleUrl("https://a.example/post", "javascript:void(0)"), "https://a.example/post");
  assert.equal(canonicalArticleUrl("https://a.example/post", "http://"), "https://a.example/post");
});
