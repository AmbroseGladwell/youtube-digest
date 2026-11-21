import test from "node:test";
import assert from "node:assert/strict";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { overviewQuotas } from "./overviewQuotas.js";
import { OverviewUsageRepository } from "./OverviewUsageRepository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function usageApp() {
  const testApp = await createTestApp();
  const { accountId } = await makeSession(testApp.sql, { now: testApp.clock.now });
  return { testApp, accountId, usage: new OverviewUsageRepository(testApp.sql) };
}

test("a reserved slot counts, and a released one is given back", async () => {
  const { testApp, accountId, usage } = await usageApp();

  const reservation = await usage.reserve(testApp.clock.now, accountId, "ours", overviewQuotas.free.ours);
  const held = await usage.usage(testApp.clock.now, accountId, "free");
  assert.equal(reservation.reserved, true);
  if (reservation.reserved) await usage.release(reservation.month, accountId, "ours");
  const released = await usage.usage(testApp.clock.now, accountId, "free");

  assert.equal(held.ours.used, 1);
  assert.equal(released.ours.used, 0);
  await testApp.close();
});

test("every success counts again, so regenerating the same video uses another slot", async () => {
  const { testApp, accountId, usage } = await usageApp();

  await usage.reserve(testApp.clock.now, accountId, "own", overviewQuotas.free.own);
  await usage.reserve(testApp.clock.now, accountId, "own", overviewQuotas.free.own);

  assert.equal((await usage.usage(testApp.clock.now, accountId, "free")).own.used, 2);
  await testApp.close();
});

test("past the quota a reservation is refused with how many were used", async () => {
  const { testApp, accountId, usage } = await usageApp();
  for (let made = 0; made < overviewQuotas.free.ours; made += 1) {
    await usage.reserve(testApp.clock.now, accountId, "ours", overviewQuotas.free.ours);
  }

  const sixth = await usage.reserve(testApp.clock.now, accountId, "ours", overviewQuotas.free.ours);

  assert.deepEqual(sixth, { reserved: false, used: overviewQuotas.free.ours, limit: overviewQuotas.free.ours });
  await testApp.close();
});

test("spending the quota on our key leaves the own-key quota whole, and the other way round", async () => {
  const { testApp, accountId, usage } = await usageApp();
  for (let made = 0; made < overviewQuotas.free.ours; made += 1) {
    await usage.reserve(testApp.clock.now, accountId, "ours", overviewQuotas.free.ours);
  }

  const own = await usage.reserve(testApp.clock.now, accountId, "own", overviewQuotas.free.own);

  assert.equal(own.reserved, true);
  assert.equal((await usage.usage(testApp.clock.now, accountId, "free")).own.used, 1);
  await testApp.close();
});

test("a new UTC month starts both counts again", async () => {
  const { testApp, accountId, usage } = await usageApp();
  await usage.reserve(testApp.clock.now, accountId, "ours", overviewQuotas.free.ours);

  testApp.clock.advance(31 * DAY_MS);
  const nextMonth = await usage.usage(testApp.clock.now, accountId, "free");

  assert.equal(nextMonth.ours.used, 0);
  assert.equal(nextMonth.resetsOn, "2026-11-01");
  await testApp.close();
});

test("a slot taken before midnight on the last day is given back to the month it was taken in", async () => {
  const testApp = await createTestApp();
  testApp.clock.now = new Date("2026-09-30T23:59:30.000Z");
  const { accountId } = await makeSession(testApp.sql, { now: testApp.clock.now });
  const usage = new OverviewUsageRepository(testApp.sql);
  await usage.reserve(testApp.clock.now, accountId, "ours", overviewQuotas.free.ours);
  const reservation = await usage.reserve(testApp.clock.now, accountId, "ours", overviewQuotas.free.ours);

  testApp.clock.advance(60 * 1000);
  await usage.reserve(testApp.clock.now, accountId, "ours", overviewQuotas.free.ours);
  if (reservation.reserved) await usage.release(reservation.month, accountId, "ours");
  const october = await usage.usage(testApp.clock.now, accountId, "free");
  testApp.clock.now = new Date("2026-09-15T00:00:00.000Z");
  const september = await usage.usage(testApp.clock.now, accountId, "free");

  assert.equal(september.ours.used, 1);
  assert.equal(october.ours.used, 1);
  await testApp.close();
});

test("the quotas are the ones set on 18 Oct 2026, per plan and key", () => {
  assert.deepEqual(overviewQuotas, {
    free: { ours: 5, own: 10 },
    "byo-plus": { ours: 10, own: 200 },
    plus: { ours: 50, own: 200 },
  });
});
