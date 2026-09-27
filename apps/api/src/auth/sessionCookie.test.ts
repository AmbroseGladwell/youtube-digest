import test from "node:test";
import assert from "node:assert/strict";
import { clearedSessionCookie, readSessionCookie, sessionCookie } from "./sessionCookie.js";

const now = new Date("2026-09-26T09:00:00.000Z");

test("a session cookie is HttpOnly, same-site, on the whole origin, and lives as long as the session", () => {
  const cookie = sessionCookie("tok-en", { expiresAt: "2026-09-27T09:00:00.000Z", now, secure: true });
  assert.equal(cookie, "overview_session=tok-en; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax; Secure");
});

test("Secure is left off when the app is served over plain http, which is only ever localhost", () => {
  const cookie = sessionCookie("t", { expiresAt: "2026-09-27T09:00:00.000Z", now, secure: false });
  assert.doesNotMatch(cookie, /Secure/);
});

test("the token is read back out of a cookie header among other cookies", () => {
  assert.equal(readSessionCookie("theme=dark; overview_session=tok-en; other=1"), "tok-en");
  assert.equal(readSessionCookie("theme=dark"), null);
  assert.equal(readSessionCookie(undefined), null);
  assert.equal(readSessionCookie("overview_session="), null);
});

test("clearing sets the same cookie to nothing with no life left", () => {
  assert.equal(clearedSessionCookie({ secure: false }), "overview_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax");
});
