import test from "node:test";
import assert from "node:assert/strict";
import { toServerError } from "./toServerError.js";

const AT = new Date("2026-10-02T09:00:00.000Z");
const ROOT = "/app";

const thrown = (message: string, stack: string) => Object.assign(new TypeError(message), { stack });

test("a server stack keeps its own frames as paths from where it runs, and marks Node's and dependencies' as not its own", () => {
  const error = thrown(
    "Cannot read properties of undefined (reading 'title')",
    [
      "TypeError: Cannot read properties of undefined (reading 'title')",
      "    at RecordsRepository.write (file:///app/apps/api/dist/records/RecordsRepository.js:41:18)",
      "    at async Object.<anonymous> (/app/apps/api/dist/routes/overviewRoutes.js:12:7)",
      "    at Client._handleReadyForQuery (/app/node_modules/pg/lib/client.js:380:12)",
      "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
      "    at async Promise.all (index 0)",
    ].join("\n"),
  );

  assert.deepEqual(toServerError(error, { caughtBy: "request", at: AT, root: ROOT }).frames, [
    { function: "RecordsRepository.write", file: "apps/api/dist/records/RecordsRepository.js", line: 41, column: 18, inApp: true },
    { function: "Object.<anonymous>", file: "apps/api/dist/routes/overviewRoutes.js", line: 12, column: 7, inApp: true },
    { function: "Client._handleReadyForQuery", file: "node_modules/pg/lib/client.js", line: 380, column: 12, inApp: false },
    { function: "process.processTicksAndRejections", file: "node:internal/process/task_queues", line: 105, column: 5, inApp: false },
  ]);
});

test("a server error's message is redacted by the same rules as a reader's", () => {
  const error = new Error('No overview "How to cook rice" for reader@example.com at https://youtube.com/watch?v=abc');

  assert.equal(
    toServerError(error, { caughtBy: "request", at: AT, root: ROOT }).message,
    "No overview <text> for <email> at <url>",
  );
});

test("something thrown that isn't an Error is still reported, as a NonError", () => {
  const serverError = toServerError("the pool is closed", { caughtBy: "unhandledRejection", at: AT, root: ROOT });

  assert.deepEqual(serverError, {
    caughtBy: "unhandledRejection",
    type: "NonError",
    message: "the pool is closed",
    frames: [],
    at: "2026-10-02T09:00:00.000Z",
  });
});
