import test from "node:test";
import assert from "node:assert/strict";
import { IDLE_EXIT_SECONDS, MACHINE_START_SECONDS, MachineTime } from "./MachineTime.js";

const at = (seconds: number) => new Date(seconds * 1000);

test("a call on a stopped machine pays its start, its own time and the idle after it", () => {
  const time = new MachineTime();

  assert.deepEqual(time.charge(at(100), at(104)), { seconds: MACHINE_START_SECONDS + 4 + IDLE_EXIT_SECONDS, cold: true });
});

test("a call while the machine idles pays only how much later it now stops", () => {
  const time = new MachineTime();
  time.charge(at(100), at(104));

  assert.deepEqual(time.charge(at(110), at(113)), { seconds: 9, cold: false });
});

test("a call that ends inside time already paid for costs nothing more", () => {
  const time = new MachineTime();
  time.charge(at(100), at(110));

  assert.deepEqual(time.charge(at(101), at(105)), { seconds: 0, cold: false });
});

test("once the idle has run out the machine has stopped, so the next call starts it again", () => {
  const time = new MachineTime();
  time.charge(at(100), at(104));

  assert.equal(time.isWarm(at(118)), true);
  assert.equal(time.isWarm(at(119)), false);
  assert.deepEqual(time.charge(at(119), at(120)), { seconds: MACHINE_START_SECONDS + 1 + IDLE_EXIT_SECONDS, cold: true });
});
