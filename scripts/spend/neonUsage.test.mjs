import test from "node:test";
import assert from "node:assert/strict";
import { neonRowsOf, neonUsage } from "./neonUsage.mjs";

const project = {
  id: "raspy-dream-86058377",
  data_storage_bytes_hour: 0,
  data_transfer_bytes: 113_935_180,
  written_data_bytes: 0,
  compute_time_seconds: 101_466,
  active_time_seconds: 402_011,
  cpu_used_sec: 0,
  consumption_period_start: "2026-11-01T00:00:00Z",
  consumption_period_end: "2026-12-01T00:00:00Z",
  owner: { subscription_type: "free_v3" },
};

const branches = [
  { id: "br-main", name: "main", logical_size: 60_000_000 },
  { id: "br-preview", name: "preview", logical_size: 2_000_000 },
];

const quantityOf = (rows, unit) => rows.find((row) => row.unit === unit).quantity;

test("this month's compute, active time and transfer so far, and storage now, as usage with no dollars", () => {
  const rows = neonRowsOf({ date: "2026-11-08", project, branches });
  assert.equal(quantityOf(rows, "compute_hours_month_to_date"), 101_466 / 3600);
  assert.equal(quantityOf(rows, "active_hours_month_to_date"), 402_011 / 3600);
  assert.equal(quantityOf(rows, "transfer_gb_month_to_date"), 0.11393518);
  assert.equal(quantityOf(rows, "storage_gb"), 0.062);
  assert.ok(rows.every((row) => row.source === "usage" && row.dollars === null && row.area === "database" && row.date === "2026-11-08"));
});

test("the project and its branches are read with the key, and a refusal says only the status", async () => {
  const urls = [];
  const fetch = async (url, init) => {
    urls.push([url, init.headers.Authorization]);
    return { ok: true, json: async () => (url.endsWith("/branches") ? { branches } : { project }) };
  };
  await neonUsage({ apiKey: "neon", projectId: "raspy-dream-86058377", fetch, date: "2026-11-08" });
  assert.deepEqual(urls.map(([url]) => url).sort(), [
    "https://console.neon.tech/api/v2/projects/raspy-dream-86058377",
    "https://console.neon.tech/api/v2/projects/raspy-dream-86058377/branches",
  ]);
  assert.ok(urls.every(([, authorization]) => authorization === "Bearer neon"));
  await assert.rejects(neonUsage({ apiKey: "neon", projectId: "p", fetch: async () => ({ ok: false, status: 401 }), date: "2026-11-08" }), {
    message: "Neon answered 401",
  });
});
