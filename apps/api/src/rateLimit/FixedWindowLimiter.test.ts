import test from "node:test";
import assert from "node:assert/strict";
import { FixedWindowLimiter } from "./FixedWindowLimiter.js";

const MINUTE_MS = 60 * 1000;
const START = new Date("2026-09-30T09:00:00.000Z");
const at = (ms: number) => new Date(START.getTime() + ms);
const threePerMinute = () => new FixedWindowLimiter({ name: "test", limit: 3, windowMs: MINUTE_MS });

test("a key is allowed up to the limit within a window and refused after it", () => {
  const limiter = threePerMinute();

  const verdicts = [0, 1, 2, 3].map((index) => limiter.take("a", at(index * 1000)).allowed);

  assert.deepEqual(verdicts, [true, true, true, false]);
});

test("a refusal says how many whole seconds remain until the window ends", () => {
  const limiter = threePerMinute();
  for (let index = 0; index < 3; index += 1) limiter.take("a", START);

  const refused = limiter.take("a", at(20_500));

  assert.deepEqual(refused, { allowed: false, retryAfterSeconds: 40 });
});

test("a refusal in the window's last moment still asks for at least one second", () => {
  const limiter = threePerMinute();
  for (let index = 0; index < 3; index += 1) limiter.take("a", START);

  const refused = limiter.take("a", at(MINUTE_MS - 1));

  assert.deepEqual(refused, { allowed: false, retryAfterSeconds: 1 });
});

test("a refused request does not count, so the key is allowed again as soon as the window ends", () => {
  const limiter = threePerMinute();
  for (let index = 0; index < 3; index += 1) limiter.take("a", START);
  for (let index = 0; index < 50; index += 1) limiter.take("a", at(30_000));

  assert.equal(limiter.take("a", at(MINUTE_MS)).allowed, true);
});

test("each key has its own window", () => {
  const limiter = threePerMinute();
  for (let index = 0; index < 3; index += 1) limiter.take("a", START);

  assert.equal(limiter.take("b", START).allowed, true);
});

test("keys whose windows have ended are forgotten, so memory follows the callers of the last window", () => {
  const limiter = threePerMinute();
  for (let index = 0; index < 100; index += 1) limiter.take(`caller-${index}`, START);

  limiter.take("late", at(MINUTE_MS));

  assert.equal(limiter.trackedKeys, 1);
});
