import test from "node:test";
import assert from "node:assert/strict";
import { LOG_LEVELS, recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";

test("an assistant's refused token request is logged at warn with its OAuth code", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });

  const response = await testApp.app.inject({
    method: "POST",
    url: "/oauth/token",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: "grant_type=password&username=reader%40example.com",
  });

  const [refused] = lines.filter(({ msg }) => msg === "request refused");
  assert.deepEqual(
    { level: refused!.level, code: refused!.code, status: refused!.status },
    { level: LOG_LEVELS.warn, code: response.json().error, status: response.statusCode },
  );
  assert.doesNotMatch(JSON.stringify(lines), /reader@example\.com/);
  await testApp.close();
});

test("an assistant's call to /mcp without a valid token is logged at warn as a refusal", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });

  await testApp.app.inject({
    method: "POST",
    url: "/mcp",
    headers: { authorization: "Bearer not-a-real-token-0123456789", "content-type": "application/json" },
    payload: {},
  });

  const [refused] = lines.filter(({ msg }) => msg === "request refused");
  assert.deepEqual(
    { level: refused!.level, code: refused!.code, status: refused!.status },
    { level: LOG_LEVELS.warn, code: "invalid_token", status: 401 },
  );
  assert.doesNotMatch(JSON.stringify(lines), /not-a-real-token/);
  await testApp.close();
});
