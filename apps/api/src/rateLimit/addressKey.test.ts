import test from "node:test";
import assert from "node:assert/strict";
import { addressKey } from "./addressKey.js";

test("an IPv4 address is its own key", () => {
  assert.equal(addressKey("203.0.113.7"), "203.0.113.7");
});

test("an IPv4 address mapped into IPv6 is the same key as the IPv4 address", () => {
  assert.equal(addressKey("::ffff:203.0.113.7"), "203.0.113.7");
});

test("IPv6 addresses in the same /64 share a key however they are written", () => {
  const keys = [
    "2001:db8:abcd:12::1",
    "2001:0db8:abcd:0012:ffff:ffff:ffff:ffff",
    "2001:DB8:ABCD:12:1:2:3:4",
    "2001:db8:abcd:12::1%eth0",
  ].map(addressKey);

  assert.deepEqual(new Set(keys), new Set(["2001:db8:abcd:12::/64"]));
});

test("IPv6 addresses in different /64s have different keys", () => {
  assert.notEqual(addressKey("2001:db8:abcd:12::1"), addressKey("2001:db8:abcd:13::1"));
});

test("a compressed run inside the /64 is expanded before the prefix is taken", () => {
  assert.equal(addressKey("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(addressKey("::1"), "0:0:0:0::/64");
});
