import test from "node:test";
import assert from "node:assert/strict";
import { otlpLogRecord } from "./otlpLogRecord.js";

const OBSERVED = new Date("2026-10-01T09:00:01.000Z");

test("a pino line becomes a record: its level a severity, its message the body, its time in nanoseconds", () => {
  const record = otlpLogRecord(
    { level: 40, time: Date.parse("2026-10-01T09:00:00.000Z"), pid: 7, hostname: "machine", msg: "client error" },
    OBSERVED,
  );

  assert.equal(record.severityText, "WARN");
  assert.equal(record.severityNumber, 13);
  assert.deepEqual(record.body, { stringValue: "client error" });
  assert.equal(record.timeUnixNano, "1790845200000000000");
  assert.equal(record.observedTimeUnixNano, "1790845201000000000");
  assert.deepEqual(record.attributes, []);
});

test("every other field is an attribute, nested ones by dotted path, so a request id can be searched for directly", () => {
  const record = otlpLogRecord(
    {
      level: 30,
      time: 0,
      msg: "client error",
      reqId: "request-1",
      failedRequestId: "request-0",
      clientError: { status: 503, handled: true, ratio: 0.5, top: { line: 12 } },
      trail: ["mcp.consentScreen.shown"],
      missing: null,
    },
    OBSERVED,
  );

  assert.deepEqual(record.attributes, [
    { key: "reqId", value: { stringValue: "request-1" } },
    { key: "failedRequestId", value: { stringValue: "request-0" } },
    { key: "clientError.status", value: { intValue: "503" } },
    { key: "clientError.handled", value: { boolValue: true } },
    { key: "clientError.ratio", value: { doubleValue: 0.5 } },
    { key: "clientError.top.line", value: { intValue: "12" } },
    { key: "trail", value: { stringValue: '["mcp.consentScreen.shown"]' } },
  ]);
});

test("pino's levels map onto OpenTelemetry's severities", () => {
  const severity = (level: number) => otlpLogRecord({ level, time: 0 }, OBSERVED).severityText;

  assert.deepEqual([10, 20, 30, 40, 50, 60].map(severity), ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]);
});
