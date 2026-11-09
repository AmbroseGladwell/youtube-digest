import test from "node:test";
import assert from "node:assert/strict";
import { EXPECTED_SPEND } from "./expectedSpend.mjs";
import { parseManualEntries } from "./manualSpend.mjs";
import { datesBetween, NO_FIGURE, NOT_BUILT, readersFromEnv, recentDays, recordSpend, rowsForDay } from "./recordSpend.mjs";

const AT = "2026-11-09T04:30:00.000Z";

function memoryStore({ failPut = false, corrupt = false } = {}) {
  const objects = new Map();
  return {
    objects,
    async put(key, text) {
      if (failPut) throw new Error(`R2 refused to store ${key}: 403`);
      objects.set(key, text);
    },
    async get(key) {
      return corrupt ? "" : (objects.get(key) ?? null);
    },
  };
}

const openAiRow = (date, environment, area, dollars) => ({ date, provider: "openai", environment, area, dollars, source: "bill" });
const parse = (csv) =>
  csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(","));

test("the nightly run covers the three whole UTC days before today", () => {
  assert.deepEqual(recentDays(new Date("2026-11-09T04:30:00Z")), { from: "2026-11-06", to: "2026-11-08" });
  assert.deepEqual(datesBetween("2026-10-30", "2026-11-01"), ["2026-10-30", "2026-10-31", "2026-11-01"]);
});

test("every expected provider has a row each day: billed, entered by hand, or not tracked", () => {
  const { rows } = rowsForDay({
    date: "2026-11-08",
    billed: [openAiRow("2026-11-08", "prod", "generation", 2), openAiRow("2026-11-07", "prod", "generation", 9)],
    manualEntries: parseManualEntries(
      JSON.stringify([{ provider: "neon", environment: "prod", area: "database", monthlyDollars: 0, from: "2026-09-27" }]),
    ),
    unreadable: new Map([["anthropic", "ANTHROPIC_ADMIN_KEY is not set"]]),
  });
  const of = (provider, environment, area) =>
    rows.find((row) => row.provider === provider && row.environment === environment && row.area === area);
  assert.equal(of("openai", "prod", "generation").dollars, 2);
  assert.deepEqual([of("openai", "dev", "generation").source, of("openai", "dev", "generation").reason], ["not_tracked", NO_FIGURE]);
  assert.deepEqual([of("neon", "prod", "database").source, of("neon", "prod", "database").dollars], ["manual", 0]);
  assert.deepEqual(
    [of("anthropic", "evals", "generation").source, of("anthropic", "evals", "generation").reason],
    ["not_tracked", "ANTHROPIC_ADMIN_KEY is not set"],
  );
  assert.deepEqual([of("fly", "prod", "servers").dollars, of("fly", "prod", "servers").reason], [null, NOT_BUILT]);
  assert.ok(rows.every((row) => row.date === "2026-11-08"));
  assert.equal(rows.length, EXPECTED_SPEND.length);
});

test("a hand-entered figure never replaces a bill, and says so", () => {
  const { rows, conflicts } = rowsForDay({
    date: "2026-11-08",
    billed: [openAiRow("2026-11-08", "prod", "generation", 2)],
    manualEntries: parseManualEntries(
      JSON.stringify([{ provider: "openai", environment: "prod", area: "generation", monthlyDollars: 300, from: "2026-11-01" }]),
    ),
    unreadable: new Map(),
  });
  assert.deepEqual(
    rows.filter((row) => row.provider === "openai" && row.area === "generation" && row.environment === "prod").map((row) => row.source),
    ["bill"],
  );
  assert.deepEqual(conflicts, ["openai/prod/generation"]);
});

test("each day is written to its own object and read back before it counts as recorded", async () => {
  const store = memoryStore();
  const { days, warnings } = await recordSpend({
    from: "2026-11-07",
    to: "2026-11-08",
    readers: {
      openai: { read: async () => [openAiRow("2026-11-07", "prod", "generation", 1), openAiRow("2026-11-08", "prod", "generation", 2)] },
    },
    manualEntries: [],
    store,
    recordedAt: AT,
  });
  assert.deepEqual(warnings, []);
  assert.deepEqual(
    days.map((day) => [day.key, day.recorded]),
    [
      ["daily/2026-11-07.csv", true],
      ["daily/2026-11-08.csv", true],
    ],
  );
  assert.ok(parse(store.objects.get("daily/2026-11-08.csv")).some((cells) => cells[1] === "openai" && cells[4] === "2.000000"));
});

test("rerunning a day replaces its rows rather than adding to them", async () => {
  const store = memoryStore();
  const run = (dollars) =>
    recordSpend({
      from: "2026-11-08",
      to: "2026-11-08",
      readers: { openai: { read: async () => [openAiRow("2026-11-08", "prod", "generation", dollars)] } },
      manualEntries: [],
      store,
      recordedAt: AT,
    });
  await run(1);
  await run(5);
  const generation = parse(store.objects.get("daily/2026-11-08.csv")).filter(
    (cells) => cells[1] === "openai" && cells[3] === "generation" && cells[2] === "prod",
  );
  assert.deepEqual(
    generation.map((cells) => cells[4]),
    ["5.000000"],
  );
});

test("a provider that errors is not tracked that day, never zero, and the run warns", async () => {
  const store = memoryStore();
  const { days, warnings } = await recordSpend({
    from: "2026-11-08",
    to: "2026-11-08",
    readers: {
      openai: {
        read: async () => {
          throw new Error("OpenAI answered 500");
        },
      },
    },
    manualEntries: [],
    store,
    recordedAt: AT,
  });
  assert.equal(days[0].recorded, true);
  assert.deepEqual(warnings, ["openai could not be read for 2026-11-08 to 2026-11-08: OpenAI answered 500"]);
  const openAi = parse(store.objects.get("daily/2026-11-08.csv")).filter((cells) => cells[1] === "openai");
  assert.ok(openAi.length > 0);
  assert.ok(openAi.every((cells) => cells[4] === "" && cells[5] === "not_tracked" && cells[6] === "OpenAI answered 500"));
});

test("a missing key warns and leaves the provider not tracked", async () => {
  const readers = readersFromEnv({}, async () => assert.fail("nothing should be fetched"));
  const { warnings } = await recordSpend({
    from: "2026-11-08",
    to: "2026-11-08",
    readers,
    manualEntries: [],
    store: memoryStore(),
    recordedAt: AT,
  });
  assert.deepEqual(warnings, ["openai is not tracked: OPENAI_ADMIN_KEY is not set"]);
});

test("a day whose write fails, or reads back different, is not recorded", async () => {
  const base = { from: "2026-11-08", to: "2026-11-08", readers: {}, manualEntries: [], recordedAt: AT };
  const failed = await recordSpend({ ...base, store: memoryStore({ failPut: true }) });
  assert.deepEqual([failed.days[0].recorded, failed.days[0].error], [false, "R2 refused to store daily/2026-11-08.csv: 403"]);
  const corrupt = await recordSpend({ ...base, store: memoryStore({ corrupt: true }) });
  assert.equal(corrupt.days[0].recorded, false);
});

test("a range of more than 180 days, or a backwards one, is refused", async () => {
  const base = { readers: {}, manualEntries: [], store: memoryStore(), recordedAt: AT };
  await assert.rejects(recordSpend({ ...base, from: "2026-11-08", to: "2026-11-07" }), /not 0/);
  await assert.rejects(recordSpend({ ...base, from: "2026-01-01", to: "2026-11-07" }), /not 311/);
});
