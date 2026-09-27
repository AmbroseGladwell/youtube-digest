import test from "node:test";
import assert from "node:assert/strict";
import { parseMailSender } from "./mailSender.js";

test("a sender written as a mail client shows it comes apart into name and address", () => {
  assert.deepEqual(parseMailSender("The Overview <signin@overview.example>"), {
    name: "The Overview",
    email: "signin@overview.example",
  });
  assert.deepEqual(parseMailSender('"The Overview" <signin@overview.example>'), {
    name: "The Overview",
    email: "signin@overview.example",
  });
});

test("a bare address has no name", () => {
  assert.deepEqual(parseMailSender(" signin@overview.example "), { name: null, email: "signin@overview.example" });
});
