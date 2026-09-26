import test from "node:test";
import assert from "node:assert/strict";
import { ApiErrorEnvelope } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";

test("an unknown /api route is a 404 in the envelope", async () => {
  const { app, close } = await createTestApp();
  const response = await app.inject({ method: "POST", url: "/api/nowhere" });

  assert.equal(response.statusCode, 404);
  assert.doesNotThrow(() => ApiErrorEnvelope.parse(response.json()));
  await close();
});
