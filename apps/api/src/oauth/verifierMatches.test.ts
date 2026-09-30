import test from "node:test";
import assert from "node:assert/strict";
import { s256Challenge, verifierMatches } from "./verifierMatches.js";

test("the S256 challenge is RFC 7636's own worked example", () => {
  assert.equal(s256Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("a verifier matches the challenge made from it and no other", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(verifierMatches(verifier, s256Challenge(verifier)), true);
  assert.equal(verifierMatches(`${verifier}x`, s256Challenge(verifier)), false);
});

test("a verifier outside RFC 7636's length or alphabet never matches", () => {
  const short = "a".repeat(42);
  assert.equal(verifierMatches(short, s256Challenge(short)), false);
  const odd = `${"a".repeat(42)}+`;
  assert.equal(verifierMatches(odd, s256Challenge(odd)), false);
});
