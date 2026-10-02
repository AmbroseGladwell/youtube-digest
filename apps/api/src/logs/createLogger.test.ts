import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, REQUEST_ID_HEADER } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { recordingLogger } from "./recordingLogger.testHelper.js";

test("a request is logged under its id by its route, never by a path holding a share token, a query, or the caller's address", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });

  await testApp.app.inject({
    method: "GET",
    url: "/s/sharetoken0123456789abcdef?utm_source=reader@example.com",
    headers: { [REQUEST_ID_HEADER]: "request-0001", [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  });

  const forRequest = lines.filter(({ reqId }) => reqId === "request-0001");
  assert.deepEqual(
    forRequest.map(({ msg }) => msg),
    ["incoming request", "request completed"],
  );
  assert.deepEqual(forRequest[0]!.req, { method: "GET", route: "/s/:token" });
  assert.deepEqual((forRequest[1]!.res as { statusCode: number }).statusCode, 404);
  const logged = JSON.stringify(lines);
  assert.doesNotMatch(logged, /sharetoken0123456789abcdef|utm_source|reader@example\.com|127\.0\.0\.1|remoteAddress/);
  await testApp.close();
});

test("a request no route matched is logged with no route rather than its path", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });

  await testApp.app.inject({ method: "GET", url: "/api/nothing-here/dQw4w9WgXcQ", headers: { [REQUEST_ID_HEADER]: "request-0002" } });

  const incoming = lines.find(({ reqId, msg }) => reqId === "request-0002" && msg === "incoming request");
  assert.deepEqual(incoming!.req, { method: "GET", route: null });
  assert.doesNotMatch(JSON.stringify(lines), /dQw4w9WgXcQ/);
  await testApp.close();
});

test("an error is logged by its type, redacted message, code and stack, never the fields a database error adds", async () => {
  const { lines, logger } = recordingLogger();
  const error = Object.assign(new Error('duplicate key value violates unique constraint "accounts_email_key"'), {
    code: "23505",
    detail: "Key (email)=(reader@example.com) already exists.",
  });

  logger.error({ err: error }, "unhandled error");

  const err = lines[0]!.err as Record<string, unknown>;
  assert.equal(err.type, "Error");
  assert.equal(err.code, "23505");
  assert.match(err.message as string, /duplicate key value/);
  assert.equal(err.detail, undefined);
  assert.doesNotMatch(JSON.stringify(lines), /reader@example\.com/);
});
