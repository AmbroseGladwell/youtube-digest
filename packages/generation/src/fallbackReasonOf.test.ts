import test from "node:test";
import assert from "node:assert/strict";
import { fallbackReasonOf } from "./fallbackReasonOf.js";
import {
  GenerationError,
  ProviderKeyRefusedError,
  ProviderOutOfCreditError,
  ProviderRequestError,
  SchemaFailureError,
} from "./GenerationError.js";

test("an account out of credit moves to the next key", () => {
  assert.equal(fallbackReasonOf(new ProviderOutOfCreditError(429, "insufficient_quota")), "out-of-credit");
});

test("a provider that is down, overloaded or rate-limiting moves to the next key", () => {
  for (const status of [429, 500, 502, 503, 529]) {
    assert.equal(fallbackReasonOf(new ProviderRequestError(status, "")), "provider-down", String(status));
  }
});

test("an answer that still breaks the schema after its retry moves to the next key", () => {
  assert.equal(fallbackReasonOf(new SchemaFailureError("still invalid")), "schema-failure");
});

test("a refused key never moves, so the reader sees the key problem", () => {
  assert.equal(fallbackReasonOf(new ProviderKeyRefusedError("invalid x-api-key")), null);
});

test("a request the provider calls malformed, or anything else, doesn't move", () => {
  assert.equal(fallbackReasonOf(new ProviderRequestError(400, "bad request")), null);
  assert.equal(fallbackReasonOf(new GenerationError("no text content")), null);
  assert.equal(fallbackReasonOf(new TypeError("fetch failed")), null);
});
