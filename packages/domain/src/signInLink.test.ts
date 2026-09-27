import test from "node:test";
import assert from "node:assert/strict";
import { signInLink, signInTokenFromHash } from "./signInLink.js";

test("a sign-in link carries the token in the fragment, where the server never sees it", () => {
  const link = signInLink("https://overview.example", "abc_-123");
  assert.equal(link, "https://overview.example/sign-in#token=abc_-123");
  assert.equal(new URL(link).hash, "#token=abc_-123");
});

test("a trailing slash on the app's address does not double up", () => {
  assert.equal(signInLink("http://localhost:5173/", "t"), "http://localhost:5173/sign-in#token=t");
});

test("the token a link carries is read back from the page's own hash", () => {
  const link = signInLink("https://overview.example", "a+b/c=");
  assert.equal(signInTokenFromHash(new URL(link).hash), "a+b/c=");
});

test("a hash with no token is no token", () => {
  assert.equal(signInTokenFromHash(""), null);
  assert.equal(signInTokenFromHash("#token="), null);
  assert.equal(signInTokenFromHash("#other=1"), null);
});
