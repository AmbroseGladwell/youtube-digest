import test from "node:test";
import assert from "node:assert/strict";
import { parseSpendCsv, spendCsv } from "./spendCsv.mjs";

const AT = "2026-11-09T04:30:00.000Z";

test("one header and one line per row, dollars to six places", () => {
  const csv = spendCsv(
    [{ date: "2026-11-08", provider: "openai", environment: "prod", area: "generation", dollars: 1.75, source: "bill" }],
    AT,
  );
  assert.equal(
    csv,
    `date,provider,environment,area,dollars,source,reason,quantity,unit,recorded_at\n2026-11-08,openai,prod,generation,1.750000,bill,,,,${AT}\n`,
  );
});

test("a figure not tracked is blank, never zero", () => {
  const csv = spendCsv(
    [
      {
        date: "2026-11-08",
        provider: "fly",
        environment: "prod",
        area: "servers",
        dollars: null,
        source: "not_tracked",
        reason: "not built yet",
      },
    ],
    AT,
  );
  assert.match(csv, /\n2026-11-08,fly,prod,servers,,not_tracked,not built yet,/);
});

test("a reason with a comma or a quote is quoted", () => {
  const csv = spendCsv(
    [{ date: "2026-11-08", provider: "x", environment: "prod", area: "y", dollars: null, source: "not_tracked", reason: 'a, "b"' }],
    AT,
  );
  assert.match(csv, /,"a, ""b""",/);
});

test("a written day parses back into the rows it was written from", () => {
  const rows = [
    { date: "2026-11-08", provider: "fly", environment: "prod", area: "servers", dollars: null, source: "not_tracked", reason: 'a, "b"' },
    {
      date: "2026-11-08",
      provider: "neon",
      environment: "prod",
      area: "database",
      dollars: null,
      source: "usage",
      quantity: 28.185,
      unit: "compute_hours_month_to_date",
    },
    { date: "2026-11-08", provider: "openai", environment: "prod", area: "generation", dollars: 1.75, source: "bill" },
  ];
  assert.deepEqual(parseSpendCsv(spendCsv(rows, AT)), [
    { ...rows[0], quantity: null, unit: undefined },
    { ...rows[1], reason: undefined },
    { ...rows[2], reason: undefined, quantity: null, unit: undefined },
  ]);
});

test("a day written before quantity and unit existed still parses", () => {
  const csv = `date,provider,environment,area,dollars,source,reason,recorded_at\n2026-11-08,openai,prod,generation,1.750000,bill,,${AT}\n`;
  assert.deepEqual(parseSpendCsv(csv), [
    {
      date: "2026-11-08",
      provider: "openai",
      environment: "prod",
      area: "generation",
      dollars: 1.75,
      source: "bill",
      reason: undefined,
      quantity: null,
      unit: undefined,
    },
  ]);
});
