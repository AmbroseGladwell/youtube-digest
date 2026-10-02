import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import pino from "pino";
import { makeRecordingErrorSink } from "./RecordingErrorSink.testHelper.js";
import { reportProcessErrors } from "./reportProcessErrors.js";

const AT = new Date("2026-10-02T09:00:00.000Z");

const reporting = () => {
  const process = new EventEmitter();
  const errorSink = makeRecordingErrorSink();
  let exits = 0;
  let exited!: () => void;
  const exitedOnce = new Promise<void>((resolve) => (exited = resolve));
  reportProcessErrors({
    errorSink,
    log: pino({ enabled: false }),
    clock: () => AT,
    exit: () => {
      exits += 1;
      exited();
    },
    process,
  });
  return { process, errorSink, exitedOnce, exits: () => exits };
};

test("an exception nothing caught is reported as the server's own, then the process exits", async () => {
  const { process, errorSink, exitedOnce } = reporting();

  process.emit("uncaughtException", new RangeError("Invalid time value"));
  await exitedOnce;

  assert.equal(errorSink.serverErrors.length, 1);
  assert.equal(errorSink.serverErrors[0]!.caughtBy, "uncaughtException");
  assert.equal(errorSink.serverErrors[0]!.type, "RangeError");
  assert.equal(errorSink.serverErrors[0]!.request, undefined);
});

test("a rejection nothing handled is reported the same way", async () => {
  const { process, errorSink, exitedOnce } = reporting();

  process.emit("unhandledRejection", new Error("Connection terminated"), Promise.resolve());
  await exitedOnce;

  assert.equal(errorSink.serverErrors[0]!.caughtBy, "unhandledRejection");
});

test("the process still exits when the error tracker is down", async () => {
  const { process, errorSink, exitedOnce, exits } = reporting();
  errorSink.failing = true;

  process.emit("uncaughtException", new Error("Out of memory"));
  await exitedOnce;

  assert.equal(exits(), 1);
});

test("a second failure while the first is being sent is logged, not reported again", async () => {
  const { process, errorSink, exitedOnce, exits } = reporting();

  process.emit("uncaughtException", new Error("first"));
  process.emit("uncaughtException", new Error("second"));
  await exitedOnce;

  assert.equal(errorSink.serverErrors.length, 1);
  assert.equal(exits(), 1);
});
