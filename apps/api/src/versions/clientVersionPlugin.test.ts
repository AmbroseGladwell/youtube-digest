import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION_HEADER } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";

test("a malformed X-Client-Version is a 400 whatever the route", async () => {
  const { app, close } = await createTestApp();
  for (const header of ["1.5", "abc", "0", "-1", ""]) {
    const response = await app.inject({
      method: "GET",
      url: "/api/handshake",
      headers: { [CLIENT_VERSION_HEADER]: header },
    });
    assert.equal(response.statusCode, 400, `header ${JSON.stringify(header)}`);
    assert.equal(response.json().error.code, "invalid_request");
  }
  await close();
});

test("a request without the header is served where the route allows it", async () => {
  const { app, close } = await createTestApp();
  const response = await app.inject({ method: "GET", url: "/api/handshake" });

  assert.equal(response.statusCode, 200);
  await close();
});
