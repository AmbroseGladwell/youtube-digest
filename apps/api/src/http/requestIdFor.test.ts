import test from "node:test";
import assert from "node:assert/strict";
import { REQUEST_ID_HEADER } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";

test("a request is logged under the id the client sent, and the answer says it back", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({
    method: "GET",
    url: "/api/health",
    headers: { [REQUEST_ID_HEADER]: "0b8f5f7e-3c1d-4a8e-9b2a-6f1e2d3c4b5a" },
  });

  assert.equal(response.headers[REQUEST_ID_HEADER], "0b8f5f7e-3c1d-4a8e-9b2a-6f1e2d3c4b5a");
  await testApp.close();
});

test("an id that is missing, or could smuggle anything into a log line, is replaced with the server's own", async () => {
  const testApp = await createTestApp();

  for (const sent of [undefined, "short", "has spaces in it", "x".repeat(65), "line\nbreak-0000"]) {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/api/health",
      headers: sent === undefined ? {} : { [REQUEST_ID_HEADER]: sent },
    });
    const answered = String(response.headers[REQUEST_ID_HEADER]);
    assert.notEqual(answered, sent);
    assert.match(answered, /^[0-9a-f-]{36}$/);
  }
  await testApp.close();
});
