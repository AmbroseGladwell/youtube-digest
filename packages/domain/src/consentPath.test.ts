import test from "node:test";
import assert from "node:assert/strict";
import { consentPath, isConsentPath } from "./consentPath.js";

const REQUEST_ID = "0b8f5f7e-3c1d-4a8e-9b2a-6f1e2d3c4b5a";

test("a consent path names one request", () => {
  assert.equal(consentPath(REQUEST_ID), `/connect/${REQUEST_ID}`);
  assert.ok(isConsentPath(consentPath(REQUEST_ID)));
});

test("anything else is not a consent path, so a link cannot be made to return elsewhere", () => {
  for (const path of [
    "/connect/",
    "/connect/not-a-uuid",
    `/connect/${REQUEST_ID}/more`,
    `/connect/${REQUEST_ID}?x=1`,
    `//evil.example/connect/${REQUEST_ID}`,
    `https://evil.example/connect/${REQUEST_ID}`,
    "/settings",
  ]) {
    assert.equal(isConsentPath(path), false, path);
  }
});
