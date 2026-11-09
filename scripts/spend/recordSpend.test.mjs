import test from "node:test";
import assert from "node:assert/strict";
import { ENTERED_BY_HAND, EXPECTED_SPEND } from "./expectedSpend.mjs";
import { parseManualEntries } from "./manualSpend.mjs";
import { parseSpendCsv, spendCsv } from "./spendCsv.mjs";
import { datesBetween, NO_FIGURE, readersFromEnv, recentDays, recordSpend, rowsForDay } from "./recordSpend.mjs";

const AT = "2026-11-09T04:30:00.000Z";
const NOW = new Date(AT);

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
  assert.deepEqual([of("fly", "prod", "servers").dollars, of("fly", "prod", "servers").reason], [null, ENTERED_BY_HAND.fly]);
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
  const readers = readersFromEnv({ NEON_PROJECT_ID: "p" }, async () => assert.fail("nothing should be fetched"), NOW);
  const { warnings } = await recordSpend({
    from: "2026-11-08",
    to: "2026-11-08",
    readers,
    manualEntries: [],
    store: memoryStore(),
    recordedAt: AT,
  });
  assert.deepEqual(warnings, [
    "openai is not tracked: OPENAI_ADMIN_KEY is not set",
    "neon is not tracked: NEON_API_KEY or NEON_PROJECT_ID is not set",
    "decodo is not tracked: DECODO_API_KEY is not set",
    "cloudflare is not tracked: CLOUDFLARE_API_TOKEN or R2_ACCOUNT_ID is not set",
  ]);
});

const neonProject = { compute_time_seconds: 36_000, active_time_seconds: 72_000, data_transfer_bytes: 2e9 };

function neonFetch() {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => (url.endsWith("/branches") ? { branches: [{ logical_size: 5e8 }] } : { project: neonProject }) };
  };
  return { fetch, calls };
}

test("Neon's month so far is recorded on yesterday as usage, beside its hand-entered cost", async () => {
  const neon = neonFetch();
  const store = memoryStore();
  await recordSpend({
    from: "2026-11-06",
    to: "2026-11-08",
    readers: readersFromEnv({ NEON_API_KEY: "k", NEON_PROJECT_ID: "p" }, neon.fetch, NOW),
    manualEntries: parseManualEntries(
      JSON.stringify([{ provider: "neon", environment: "prod", area: "database", monthlyDollars: 0, from: "2026-09-27" }]),
    ),
    store,
    recordedAt: AT,
  });
  const neonRows = (date) => parse(store.objects.get(`daily/${date}.csv`)).filter((cells) => cells[1] === "neon");
  assert.deepEqual(
    neonRows("2026-11-08").map((cells) => [cells[4], cells[5], cells[7], cells[8]]),
    [
      ["0.000000", "manual", "", ""],
      ["", "usage", "20", "active_hours_month_to_date"],
      ["", "usage", "10", "compute_hours_month_to_date"],
      ["", "usage", "0.5", "storage_gb"],
      ["", "usage", "2", "transfer_gb_month_to_date"],
    ],
  );
  assert.deepEqual(
    neonRows("2026-11-07").map((cells) => cells[5]),
    ["manual"],
  );
});

test("a backfill that does not end yesterday reads nothing from Neon, since it only knows the month so far", async () => {
  const neon = neonFetch();
  await recordSpend({
    from: "2026-10-01",
    to: "2026-10-31",
    readers: readersFromEnv({ NEON_API_KEY: "k", NEON_PROJECT_ID: "p" }, neon.fetch, NOW),
    manualEntries: [],
    store: memoryStore(),
    recordedAt: AT,
  });
  assert.deepEqual(neon.calls, []);
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

const storeWith = (days) => {
  const store = memoryStore();
  for (const [date, rows] of Object.entries(days)) store.objects.set(`daily/${date}.csv`, spendCsv(rows, AT));
  return store;
};

test("a day a reader cannot read keeps that provider's stored figures instead of blanking them", async () => {
  const store = storeWith({
    "2026-11-07": [
      { date: "2026-11-07", provider: "cloudflare", environment: "unsplit", area: "storage", dollars: 0.5, source: "bill" },
      {
        date: "2026-11-07",
        provider: "cloudflare",
        environment: "prod",
        area: "storage",
        dollars: null,
        source: "usage",
        quantity: 0.1,
        unit: "storage_gb",
      },
    ],
  });
  const { days } = await recordSpend({
    from: "2026-11-07",
    to: "2026-11-08",
    readers: {
      cloudflare: {
        read: async () => ({
          rows: [{ date: "2026-11-08", provider: "cloudflare", environment: "unsplit", area: "storage", dollars: 0.25, source: "bill" }],
          readable: (date) => date >= "2026-11-08",
          outOfRange: "before the current billing period",
        }),
      },
    },
    manualEntries: [],
    store,
    recordedAt: AT,
  });
  const cloudflare = (date) => parseSpendCsv(store.objects.get(`daily/${date}.csv`)).filter((row) => row.provider === "cloudflare");
  assert.deepEqual(
    cloudflare("2026-11-07").map((row) => [row.source, row.dollars ?? row.quantity]),
    [
      ["usage", 0.1],
      ["bill", 0.5],
    ],
  );
  assert.deepEqual(days[0].keptFrom, ["cloudflare"]);
  assert.deepEqual(
    cloudflare("2026-11-08").map((row) => row.dollars),
    [0.25],
  );
});

test("an out-of-range day with nothing stored is not tracked with the reader's reason", async () => {
  const store = memoryStore();
  await recordSpend({
    from: "2026-10-01",
    to: "2026-10-01",
    readers: { cloudflare: { read: async () => ({ rows: [], readable: () => false, outOfRange: "before the current billing period" }) } },
    manualEntries: [],
    store,
    recordedAt: AT,
  });
  const [row] = parseSpendCsv(store.objects.get("daily/2026-10-01.csv")).filter((stored) => stored.provider === "cloudflare");
  assert.deepEqual([row.source, row.reason], ["not_tracked", "before the current billing period"]);
});

test("a provider that fails keeps its stored bill rather than losing a day already recorded", async () => {
  const store = storeWith({ "2026-11-08": [openAiRow("2026-11-08", "prod", "generation", 3)] });
  const { warnings } = await recordSpend({
    from: "2026-11-08",
    to: "2026-11-08",
    readers: {
      openai: {
        read: async () => {
          throw new Error("OpenAI answered 503");
        },
      },
    },
    manualEntries: [],
    store,
    recordedAt: AT,
  });
  const openAi = parseSpendCsv(store.objects.get("daily/2026-11-08.csv")).filter((row) => row.provider === "openai");
  assert.equal(openAi.find((row) => row.environment === "prod" && row.area === "generation").dollars, 3);
  assert.equal(openAi.find((row) => row.environment === "dev" && row.area === "generation").reason, "OpenAI answered 503");
  assert.equal(warnings.length, 1);
});

test("stored hand-entered and not-tracked rows are never kept, so today's figures and reasons win", async () => {
  const store = storeWith({
    "2026-11-08": [
      { date: "2026-11-08", provider: "neon", environment: "prod", area: "database", dollars: 9, source: "manual" },
      { date: "2026-11-08", provider: "neon", environment: "prod", area: "database", dollars: null, source: "not_tracked", reason: "old" },
    ],
  });
  await recordSpend({
    from: "2026-11-08",
    to: "2026-11-08",
    readers: { neon: { read: async () => ({ rows: [], readable: () => false, outOfRange: "only yesterday" }) } },
    manualEntries: parseManualEntries(
      JSON.stringify([{ provider: "neon", environment: "prod", area: "database", monthlyDollars: 0, from: "2026-09-27" }]),
    ),
    store,
    recordedAt: AT,
  });
  const neon = parseSpendCsv(store.objects.get("daily/2026-11-08.csv")).filter((row) => row.provider === "neon");
  assert.deepEqual(
    neon.map((row) => [row.source, row.dollars]),
    [["manual", 0]],
  );
});

test("Neon's usage recorded on earlier nights survives later nights' rewrites", async () => {
  const store = memoryStore();
  const night = async (now, project) => {
    const fetch = async (url) => ({ ok: true, json: async () => (url.endsWith("/branches") ? { branches: [] } : { project }) });
    const { from, to } = recentDays(new Date(now));
    await recordSpend({
      from,
      to,
      readers: readersFromEnv({ NEON_API_KEY: "k", NEON_PROJECT_ID: "p" }, fetch, new Date(now)),
      manualEntries: [],
      store,
      recordedAt: now,
    });
  };
  await night("2026-11-09T04:30:00Z", { compute_time_seconds: 3600, active_time_seconds: 0, data_transfer_bytes: 0 });
  await night("2026-11-10T04:30:00Z", { compute_time_seconds: 7200, active_time_seconds: 0, data_transfer_bytes: 0 });
  const computeOn = (date) =>
    parseSpendCsv(store.objects.get(`daily/${date}.csv`)).find((row) => row.unit === "compute_hours_month_to_date")?.quantity;
  assert.equal(computeOn("2026-11-08"), 1);
  assert.equal(computeOn("2026-11-09"), 2);
});
