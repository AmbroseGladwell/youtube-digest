import test from "node:test";
import assert from "node:assert/strict";
import { signInLink, signInReturnFromSearch, signInTokenFromHash } from "./signInLink.js";

const CONSENT = "/connect/0b8f5f7e-3c1d-4a8e-9b2a-6f1e2d3c4b5a";

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

test("a link asked for from the consent screen says where to return, outside the fragment", () => {
  const link = new URL(signInLink("https://overview.example", "t", CONSENT));
  assert.equal(link.pathname, "/sign-in");
  assert.equal(signInReturnFromSearch(link.search), CONSENT);
  assert.equal(signInTokenFromHash(link.hash), "t");
});

test("a return anywhere but a consent screen is ignored", () => {
  assert.equal(signInReturnFromSearch(""), null);
  assert.equal(signInReturnFromSearch("?return=%2F%2Fevil.example"), null);
  assert.equal(signInReturnFromSearch("?return=https%3A%2F%2Fevil.example%2Fconnect%2Fx"), null);
  assert.equal(signInReturnFromSearch("?return=%2Fsettings"), null);
});
