import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedRedirectUri } from "./isAllowedRedirectUri.js";

test("https addresses are allowed anywhere", () => {
  assert.equal(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"), true);
});

test("plain http is allowed only back to this machine", () => {
  assert.equal(isAllowedRedirectUri("http://localhost:6274/callback"), true);
  assert.equal(isAllowedRedirectUri("http://127.0.0.1:33418/"), true);
  assert.equal(isAllowedRedirectUri("http://[::1]:8080/cb"), true);
  assert.equal(isAllowedRedirectUri("http://example.com/callback"), false);
});

test("a fragment, credentials, other schemes and non-URLs are refused", () => {
  assert.equal(isAllowedRedirectUri("https://claude.ai/callback#x"), false);
  assert.equal(isAllowedRedirectUri("https://user:pass@claude.ai/callback"), false);
  assert.equal(isAllowedRedirectUri("javascript:alert(1)"), false);
  assert.equal(isAllowedRedirectUri("data:text/html,hi"), false);
  assert.equal(isAllowedRedirectUri("not a url"), false);
});
