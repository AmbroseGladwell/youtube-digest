import test from "node:test";
import assert from "node:assert/strict";
import { formatLinkCode, generateLinkCode, normaliseLinkCode } from "./linkCode.js";

test("a link code is eight characters from an alphabet with no look-alikes", () => {
  for (let i = 0; i < 200; i++) {
    assert.match(generateLinkCode(), /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
  }
});

test("a code is shown in two groups and read back whatever the reader did to it", () => {
  assert.equal(formatLinkCode("ABCD2345"), "ABCD-2345");
  assert.equal(normaliseLinkCode(" abcd-2345 "), "ABCD2345");
  assert.equal(normaliseLinkCode("ABCD 2345"), "ABCD2345");
});
