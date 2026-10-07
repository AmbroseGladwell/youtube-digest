import test from "node:test";
import assert from "node:assert/strict";
import { API_LOG_LINES, apiLogLines } from "./logLines.js";

test("every line is coded service.area.event in camelCase and says what it means", () => {
  for (const { logCode, description } of API_LOG_LINES) {
    assert.match(logCode, /^[a-z][A-Za-z]*\.[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/, logCode);
    assert.ok(description.length > 20, `${logCode} needs a description someone reading the logs can use`);
  }
});

test("a code is its position in the catalogue, so it cannot drift from where it is declared", () => {
  for (const [area, events] of Object.entries(apiLogLines)) {
    for (const [event, line] of Object.entries(events)) {
      assert.equal(line.logCode, `api.${area}.${event}`);
    }
  }
});

test("no two lines share a code", () => {
  const codes = API_LOG_LINES.map(({ logCode }) => logCode);
  assert.deepEqual([...new Set(codes)].sort(), [...codes].sort());
});

test("a message is a short lower-case phrase, so it reads as prose beside the code", () => {
  for (const { logCode, message } of API_LOG_LINES) {
    assert.match(message, /^[a-z][a-z0-9 ,'-]*$/, `${logCode}: ${message}`);
    assert.ok(message.length <= 60, `${logCode}: ${message}`);
  }
});

test("calling a line carries its code and message, and whatever the call site passed", () => {
  assert.deepEqual(apiLogLines.audio.rendered({ key: "abc", bytes: 10 }), {
    key: "abc",
    bytes: 10,
    logCode: "api.audio.rendered",
    msg: "audio rendered",
  });
  assert.deepEqual(apiLogLines.shares.revoked(), { logCode: "api.shares.revoked", msg: "share revoked" });
});

test("a line declares the level it is written at, so the catalogue reads as the whole story", () => {
  assert.equal(apiLogLines.audio.renderGaveUp.level, "error");
  assert.equal(apiLogLines.audio.renderFailed.level, "warn");
  assert.equal(apiLogLines.process.uncaughtException.level, "fatal");
});
