import test from "node:test";
import assert from "node:assert/strict";
import { extensionIdFrom, extensionOriginFrom } from "./extensionId.mjs";

// The id openssl and shasum derive for this key, so the two derivations agree.
const PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArj8I82fIpokYLDFL69EWUc9BxI+OyrbeYWclPfvr/Z6UWBowbIR5NHwbJyv59IdCyYLI+KBkcsZoti6bw1aoXk8+KeXlxacbLzauqGvN3BDjRkZUkzdpdyjU6mHNxBj1dsyKgD98SY0vPajnd2LzBk2EO6T6AdjQ8G56g4LqS3t3UoaYIS6+tQ/jEJJbNPwqrrOJiMQb1QMHyWUGk51TFSriCGrvfpuHIwsx4Hjyi3Jr17WQPzQpowXH8xVybNxkyg9EdkfMlQjaNsaS+SR6GrxeLLO/Leq4OXSYmwVO6BRDtN5jGJ/qZESQE2/K5/OId4pk8/fcbWMBFhpzlV4yyQIDAQAB";

test("the id is the first half of the key's SHA-256, spelt a to p", () => {
  assert.equal(extensionIdFrom(PUBLIC_KEY), "jnbehpjepnpckmjnbdmckkplbbbmgnhg");
});

test("a manifest with a key answers its origin", () => {
  assert.equal(
    extensionOriginFrom({ key: PUBLIC_KEY }),
    "chrome-extension://jnbehpjepnpckmjnbdmckkplbbbmgnhg",
  );
});

test("a manifest without a key is refused with the step that fixes it", () => {
  assert.throws(() => extensionOriginFrom({ name: "The Overview" }), /upload a draft to the Web Store/);
  assert.throws(() => extensionOriginFrom({ key: "" }), /upload a draft to the Web Store/);
});
