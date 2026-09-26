import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, Handshake } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";

test("the handshake carries the floor from config and the server's own client version", async () => {
  const { app, close } = await createTestApp({ minSupportedClientVersion: 1 });
  const response = await app.inject({ method: "GET", url: "/api/handshake" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(Handshake.parse(response.json()), {
    minSupportedClientVersion: 1,
    currentClientVersion: CLIENT_VERSION,
  });
  await close();
});

test("the handshake is served to a client below the floor and is never cached", async () => {
  const floored = await createTestApp({ minSupportedClientVersion: 2 });
  const response = await floored.app.inject({
    method: "GET",
    url: "/api/handshake",
    headers: { [CLIENT_VERSION_HEADER]: "1" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  await floored.close();
});
