import test from "node:test";
import assert from "node:assert/strict";
import { appleCallBudget, AppleBudgetSpentError } from "./appleCallBudget.js";

const harness = (perMinute: number, mostWaitMs: number) => {
  let now = 0;
  const asked: string[] = [];
  const call = appleCallBudget(
    async (url) => {
      asked.push(url);
      return { url };
    },
    {
      perMinute,
      mostWaitMs,
      keepMs: () => 60 * 60_000,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    },
  );
  return { call, asked, at: () => now };
};

test("an answer already had is not asked of Apple again while it's kept", async () => {
  const { call, asked } = harness(15, 20_000);
  await call("https://itunes.apple.com/lookup?id=1");
  await call("https://itunes.apple.com/lookup?id=1");
  assert.deepEqual(asked, ["https://itunes.apple.com/lookup?id=1"]);
});

test("past the minute's budget a call waits for the oldest to leave the window", async () => {
  const { call, asked, at } = harness(2, 70_000);
  await call("a");
  await call("b");
  await call("c");
  assert.deepEqual(asked, ["a", "b", "c"]);
  assert.equal(at(), 60_000);
});

test("a call that would wait longer than allowed gives up rather than hold the reader", async () => {
  const { call } = harness(1, 5_000);
  await call("a");
  await assert.rejects(call("b"), (error) => error instanceof AppleBudgetSpentError);
});
