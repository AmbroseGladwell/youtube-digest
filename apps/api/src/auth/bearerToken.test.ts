import test from "node:test";
import assert from "node:assert/strict";
import { bearerToken } from "./bearerToken.js";

test("reads the token out of a Bearer header", () => {
  assert.equal(bearerToken("Bearer abc.def"), "abc.def");
});

test("a non-Bearer scheme is no token", () => {
  assert.equal(bearerToken("Basic abc"), null);
});

test("an empty Bearer is no token", () => {
  assert.equal(bearerToken("Bearer "), null);
  assert.equal(bearerToken(undefined), null);
});
