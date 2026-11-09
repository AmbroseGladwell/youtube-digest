import test from "node:test";
import assert from "node:assert/strict";
import { decodoRowsOf, decodoUsage } from "./decodoUsage.mjs";

const metadata = (totalPages, currentPage) => ({
  total_items: 3,
  total_pages: totalPages,
  current_page: currentPage,
  sort_by: "grouping_key",
  sort_order: "desc",
  totals: {
    total_rx: 900_000,
    total_tx: 100_000,
    total_rx_tx: 1_000_000,
    requests: 9,
    unsuccessful_requests: 0,
    response_time: 0,
    success_rate: 0,
  },
  limit: 500,
});

const day = (key, rxTx, requests) => ({ key: `${key} 00:00:00`, rx_bytes: rxTx - 10, tx_bytes: 10, rx_tx_bytes: rxTx, requests });

const of = (rows, date, unit) => rows.find((row) => row.date === date && row.unit === unit).quantity;

test("each day's proxy traffic and requests are usage, with no dollars, and a quiet day is zero rather than missing", () => {
  const rows = decodoRowsOf({ dates: ["2026-10-06", "2026-10-07"], data: [day("2026-10-07", 444_109, 6)] });
  assert.equal(of(rows, "2026-10-07", "proxy_traffic_gb"), 0.000444109);
  assert.equal(of(rows, "2026-10-07", "proxy_requests"), 6);
  assert.equal(of(rows, "2026-10-06", "proxy_traffic_gb"), 0);
  assert.equal(of(rows, "2026-10-06", "proxy_requests"), 0);
  assert.ok(
    rows.every(
      (row) =>
        row.provider === "decodo" &&
        row.environment === "prod" &&
        row.area === "transcripts" &&
        row.source === "usage" &&
        row.dollars === null,
    ),
  );
});

test("every page of daily traffic is read for the whole range, with the key as it is", async () => {
  const bodies = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    bodies.push({ url, authorization: init.headers.Authorization, body });
    return {
      ok: true,
      json: async () =>
        body.page === 1
          ? { metadata: metadata(2, 1), data: [day("2026-10-07", 444_109, 6)] }
          : { metadata: metadata(2, 2), data: [day("2026-10-08", 1000, 1)] },
    };
  };
  const rows = await decodoUsage({ apiKey: "key", fetch, dates: ["2026-10-07", "2026-10-08"] });
  assert.equal(of(rows, "2026-10-08", "proxy_requests"), 1);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].url, "https://api.decodo.com/api/v2/statistics/traffic");
  assert.equal(bodies[0].authorization, "key");
  assert.deepEqual(
    { ...bodies[0].body, page: undefined },
    {
      proxyType: "residential_proxies",
      startDate: "2026-10-07 00:00:00",
      endDate: "2026-10-08 23:59:59",
      groupBy: "day",
      limit: 500,
      page: undefined,
    },
  );
});

test("a refused read says only the status", async () => {
  await assert.rejects(decodoUsage({ apiKey: "key", fetch: async () => ({ ok: false, status: 401 }), dates: ["2026-10-07"] }), {
    message: "Decodo answered 401",
  });
});
