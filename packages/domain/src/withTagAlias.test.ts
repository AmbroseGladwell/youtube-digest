import test from "node:test";
import assert from "node:assert/strict";
import { withTagAlias } from "./withTagAlias.js";

test("merging a tag records where it went", () => {
  assert.deepEqual(withTagAlias({}, "micro-saas", "saas"), { "micro-saas": "saas" });
});

test("an earlier alias follows its tag when that tag is merged again, so lookups stay one step", () => {
  assert.deepEqual(withTagAlias({ "micro-saas": "saas" }, "saas", "software"), {
    "micro-saas": "software",
    saas: "software",
  });
});

test("renaming back onto a merged-away name stops it being an alias", () => {
  assert.deepEqual(withTagAlias({ "micro-saas": "saas" }, "saas", "micro-saas"), { saas: "micro-saas" });
});

test("deleting a tag blocks it, and blocks whatever had been merged into it", () => {
  assert.deepEqual(withTagAlias({ "micro-saas": "saas" }, "saas", null), { "micro-saas": null, saas: null });
});
