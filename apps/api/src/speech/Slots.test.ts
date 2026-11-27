import test from "node:test";
import assert from "node:assert/strict";
import { Slots } from "./Slots.js";

test("only as many hold a slot as there are, and the next in line gets one when it is given back", async () => {
  const slots = new Slots(1);
  const order: string[] = [];

  const first = await slots.take();
  const second = slots.take().then((release) => {
    order.push("second");
    return release;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, []);

  first();
  (await second)();
  assert.deepEqual(order, ["second"]);
});

test("giving a slot back twice frees it only once", async () => {
  const slots = new Slots(1);
  const release = await slots.take();
  release();
  release();

  await slots.take();
  let third = false;
  void slots.take().then(() => {
    third = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(third, false);
});
