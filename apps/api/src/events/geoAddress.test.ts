import test from "node:test";
import assert from "node:assert/strict";
import { addressKey } from "../rateLimit/addressKey.js";
import { geoAddress } from "./geoAddress.js";

test("an IPv4 caller is placed by their /24", () => {
  assert.equal(geoAddress(addressKey("81.2.69.160")), "81.2.69.0");
  assert.equal(geoAddress(addressKey("::ffff:81.2.69.160")), "81.2.69.0");
});

test("an IPv6 caller is placed by their /64", () => {
  assert.equal(geoAddress(addressKey("2a01:4b00:8a3c:1200:1c2d:3e4f:5a6b:7c8d")), "2a01:4b00:8a3c:1200::");
});

test("anything else is not passed on", () => {
  assert.equal(geoAddress(""), null);
  assert.equal(geoAddress("not-an-address"), null);
});
