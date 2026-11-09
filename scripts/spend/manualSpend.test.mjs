import test from "node:test";
import assert from "node:assert/strict";
import { manualRowsFor, parseManualEntries } from "./manualSpend.mjs";

const neon = { provider: "neon", environment: "prod", area: "database", monthlyDollars: 0, from: "2026-09-27" };
const fly = { provider: "fly", environment: "prod", area: "servers", monthlyDollars: 30, from: "2026-11-01", to: "2026-11-30" };

test("no variable, or an empty one, means no hand-entered figures", () => {
  assert.deepEqual(parseManualEntries(undefined), []);
  assert.deepEqual(parseManualEntries("  "), []);
});

test("entries parse with an open end by default", () => {
  assert.deepEqual(parseManualEntries(JSON.stringify([neon])), [{ ...neon, to: null }]);
});

test("an entry missing a field, or with a negative figure, refuses the whole list", () => {
  assert.throws(() => parseManualEntries(JSON.stringify([{ ...neon, area: "" }])), /entry 0/);
  assert.throws(() => parseManualEntries(JSON.stringify([neon, { ...fly, monthlyDollars: -1 }])), /entry 1/);
  assert.throws(() => parseManualEntries(JSON.stringify([{ ...neon, from: "Nov 1" }])), /entry 0/);
  assert.throws(() => parseManualEntries("{"), /not JSON/);
  assert.throws(() => parseManualEntries("{}"), /not a list/);
});

test("a monthly figure is spread evenly over the days of its month, and marked as entered by hand", () => {
  const entries = parseManualEntries(JSON.stringify([fly]));
  const [row] = manualRowsFor(entries, "2026-11-08");
  assert.deepEqual(row, { date: "2026-11-08", provider: "fly", environment: "prod", area: "servers", dollars: 1, source: "manual" });
  assert.equal(
    manualRowsFor(parseManualEntries(JSON.stringify([{ ...fly, from: "2026-01-01", to: null }])), "2026-02-10")[0].dollars,
    30 / 28,
  );
});

test("an entry applies only between its dates", () => {
  const entries = parseManualEntries(JSON.stringify([fly]));
  assert.deepEqual(manualRowsFor(entries, "2026-10-31"), []);
  assert.equal(manualRowsFor(entries, "2026-11-30").length, 1);
  assert.deepEqual(manualRowsFor(entries, "2026-12-01"), []);
});
