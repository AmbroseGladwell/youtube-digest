import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

const EXTENSION = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const ELSEWHERE = "https://elsewhere.example";

const headerList = (value: string | number | string[] | undefined) =>
  String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase());

test("a preflight from a listed origin is answered without a session, naming what a sync write sends", async () => {
  const { app, close } = await createTestApp({ allowedOrigins: [EXTENSION] });

  const response = await app.inject({
    method: "OPTIONS",
    url: "/api/overviews",
    headers: {
      origin: EXTENSION,
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization, content-type, if-match, x-client-version",
    },
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], EXTENSION);
  const methods = headerList(response.headers["access-control-allow-methods"]);
  for (const method of ["get", "post", "put", "delete"]) {
    assert.ok(methods.includes(method), `allows ${method}`);
  }
  const allowed = headerList(response.headers["access-control-allow-headers"]);
  for (const header of ["authorization", "content-type", "if-match", CLIENT_VERSION_HEADER]) {
    assert.ok(allowed.includes(header), `allows ${header}`);
  }
  await close();
});

test("a write from a listed origin carries the origin back and exposes its ETag", async () => {
  const testApp = await createTestApp({ allowedOrigins: [EXTENSION] });
  const account = await makeAccount(testApp);

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/overviews",
    headers: { ...account.headers, [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION), origin: EXTENSION },
    payload: storedOverview(),
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.headers["access-control-allow-origin"], EXTENSION);
  assert.ok(headerList(response.headers["access-control-expose-headers"]).includes("etag"));
  assert.ok(headerList(response.headers.vary).includes("origin"));
  await testApp.close();
});

test("an error answered to a listed origin still carries the origin, so the client can read the envelope", async () => {
  const { app, close } = await createTestApp({ allowedOrigins: [EXTENSION] });

  const response = await app.inject({ method: "GET", url: "/api/session", headers: { origin: EXTENSION } });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.equal(response.headers["access-control-allow-origin"], EXTENSION);
  await close();
});

test("an origin that is not listed is not vouched for", async () => {
  const { app, close } = await createTestApp({ allowedOrigins: [EXTENSION] });

  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/api/overviews",
    headers: { origin: ELSEWHERE, "access-control-request-method": "POST" },
  });
  const request = await app.inject({ method: "GET", url: "/api/handshake", headers: { origin: ELSEWHERE } });

  assert.equal(preflight.headers["access-control-allow-origin"], undefined);
  assert.equal(request.statusCode, 200);
  assert.equal(request.headers["access-control-allow-origin"], undefined);
  await close();
});

test("with no origins configured nothing is vouched for, and a preflight is a 404 in the envelope", async () => {
  const { app, close } = await createTestApp();

  const preflight = await app.inject({
    method: "OPTIONS",
    url: "/api/overviews",
    headers: { origin: EXTENSION, "access-control-request-method": "POST" },
  });
  const request = await app.inject({ method: "GET", url: "/api/handshake", headers: { origin: EXTENSION } });

  assert.equal(preflight.statusCode, 404);
  assert.equal(preflight.json().error.code, "not_found");
  assert.equal(request.headers["access-control-allow-origin"], undefined);
  await close();
});
