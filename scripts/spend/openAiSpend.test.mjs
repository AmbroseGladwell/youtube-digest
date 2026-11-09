import test from "node:test";
import assert from "node:assert/strict";
import { areaOfLineItem, environmentOfProject, openAiRowsOf, openAiSpend, UNSPLIT } from "./openAiSpend.mjs";

const NOV_8 = 1_794_096_000;
const NOV_9 = NOV_8 + 86_400;
const NOV_10 = NOV_9 + 86_400;

const projects = [
  { object: "organization.project", id: "proj_evals", name: "The Overview Evals", status: "active", created_at: 1_794_182_400 },
  { object: "organization.project", id: "proj_prod", name: "The Overview Prod", status: "active", created_at: 1_790_640_000 },
  { object: "organization.project", id: "proj_dev", name: "The Overview Dev", status: "active", created_at: 1_794_182_400 },
  { object: "organization.project", id: "proj_old", name: "Sandbox", status: "archived", created_at: 1_790_640_000 },
];

const result = (projectId, lineItem, value) => ({
  object: "organization.costs.result",
  amount: { value, currency: "usd" },
  api_key_id: null,
  api_source: null,
  line_item: lineItem,
  organization_id: "org-1",
  organization_name: "Personal",
  project_id: projectId,
  project_name: projects.find((project) => project.id === projectId)?.name ?? null,
  quantity: null,
  quantity_unit: null,
  user_email: null,
  user_id: null,
});

const bucket = (startTime, results) => ({ object: "bucket", start_time: startTime, end_time: startTime + 86_400, results });

const find = (rows, date, environment, area) =>
  rows.find((row) => row.date === date && row.environment === environment && row.area === area);

test("a project's environment is the word its name starts or ends with", () => {
  assert.equal(environmentOfProject("The Overview Prod", "2026-11-09"), "prod");
  assert.equal(environmentOfProject("The Overview Production", "2026-11-09"), "prod");
  assert.equal(environmentOfProject("The Overview Evals", "2026-11-09"), "evals");
  assert.equal(environmentOfProject("dev", "2026-11-09"), "dev");
  assert.equal(environmentOfProject("The Overview", "2026-11-09"), "unattributed");
  assert.equal(environmentOfProject("productive", "2026-11-09"), "unattributed");
});

test("the production project before keys were split by environment is unsplit, not prod", () => {
  assert.equal(environmentOfProject("The Overview Prod", "2026-11-08"), "unsplit");
});

test("embedding line items are embeddings, every other line item is generation", () => {
  assert.equal(areaOfLineItem("text-embedding-3-small"), "embeddings");
  assert.equal(areaOfLineItem("gpt-6.1-sol, cache writes"), "generation");
  assert.equal(areaOfLineItem("gpt-5-mini-2025-08-07, input"), "generation");
  assert.equal(areaOfLineItem(null), "generation");
});

test("costs add up per day, environment and area, from the bill", () => {
  const rows = openAiRowsOf({
    projects,
    buckets: [
      bucket(NOV_9, [
        result("proj_prod", "gpt-6.1-sol, cache writes", 0.5),
        result("proj_prod", "gpt-6.1-sol, output", 1.25),
        result("proj_prod", "text-embedding-3-small", 0.01),
        result("proj_evals", "gpt-6.1-sol, output", 3),
      ]),
      bucket(NOV_10, [result("proj_dev", "gpt-6.1-sol, output", 2)]),
    ],
  });
  assert.equal(find(rows, "2026-11-09", "prod", "generation").dollars, 1.75);
  assert.equal(find(rows, "2026-11-09", "prod", "embeddings").dollars, 0.01);
  assert.equal(find(rows, "2026-11-09", "evals", "generation").dollars, 3);
  assert.equal(find(rows, "2026-11-10", "dev", "generation").dollars, 2);
  assert.ok(rows.every((row) => row.source === "bill" && row.provider === "openai"));
});

test("an expected area with no cost that day is recorded as zero, not left out", () => {
  const rows = openAiRowsOf({ projects, buckets: [bucket(NOV_9, [])] });
  assert.equal(find(rows, "2026-11-09", "dev", "generation").dollars, 0);
  assert.equal(find(rows, "2026-11-09", "prod", "embeddings").dollars, 0);
});

test("before the split, the one project's spend is unsplit and each environment is not tracked rather than zero", () => {
  const rows = openAiRowsOf({ projects, buckets: [bucket(NOV_8, [result("proj_prod", "gpt-6.1-sol, output", 13)])] });
  assert.equal(find(rows, "2026-11-08", "unsplit", "generation").dollars, 13);
  const prod = find(rows, "2026-11-08", "prod", "generation");
  assert.deepEqual([prod.dollars, prod.source, prod.reason], [null, "not_tracked", UNSPLIT]);
  assert.equal(find(rows, "2026-11-08", "unsplit", "embeddings").dollars, 0);
});

test("cost on a project that is not an environment, or on no project, is unattributed rather than dropped", () => {
  const rows = openAiRowsOf({
    projects,
    buckets: [bucket(NOV_9, [result("proj_old", "gpt-6.1-sol, input", 0.2), result(null, "gpt-6.1-sol, input", 0.3)])],
  });
  assert.equal(find(rows, "2026-11-09", "unattributed", "generation").dollars, 0.5);
});

function fakeOpenAi({ status = 200 } = {}) {
  const urls = [];
  const fetch = async (url, init) => {
    urls.push({ url: new URL(url), authorization: init.headers.Authorization });
    if (status !== 200) return { ok: false, status };
    const { pathname, searchParams } = new URL(url);
    if (pathname.endsWith("/projects")) {
      return searchParams.get("after") === null
        ? { ok: true, json: async () => ({ object: "list", data: projects.slice(0, 2), has_more: true, last_id: "proj_prod" }) }
        : { ok: true, json: async () => ({ object: "list", data: projects.slice(2), has_more: false, last_id: "proj_old" }) };
    }
    return searchParams.get("page") === null
      ? {
          ok: true,
          json: async () => ({
            object: "page",
            data: [bucket(NOV_9, [result("proj_prod", "gpt-6.1-sol, input", 1)])],
            has_more: true,
            next_page: "p2",
          }),
        }
      : {
          ok: true,
          json: async () => ({
            object: "page",
            data: [bucket(NOV_10, [result("proj_dev", "gpt-6.1-sol, input", 4)])],
            has_more: false,
            next_page: null,
          }),
        };
  };
  return { fetch, urls };
}

test("every page of projects and costs is read, for whole UTC days, grouped by project and line item", async () => {
  const openAi = fakeOpenAi();
  const rows = await openAiSpend({ adminKey: "admin", fetch: openAi.fetch, from: "2026-11-09", to: "2026-11-10" });
  assert.equal(find(rows, "2026-11-09", "prod", "generation").dollars, 1);
  assert.equal(find(rows, "2026-11-10", "dev", "generation").dollars, 4);
  const costs = openAi.urls.filter(({ url }) => url.pathname.endsWith("/costs"));
  assert.equal(costs.length, 2);
  assert.equal(costs[0].url.searchParams.get("start_time"), String(NOV_9));
  assert.equal(costs[0].url.searchParams.get("end_time"), String(NOV_10 + 86_400));
  assert.deepEqual(costs[0].url.searchParams.getAll("group_by"), ["project_id", "line_item"]);
  assert.ok(openAi.urls.every(({ authorization }) => authorization === "Bearer admin"));
});

test("a refused read says only the status", async () => {
  await assert.rejects(openAiSpend({ adminKey: "admin", fetch: fakeOpenAi({ status: 401 }).fetch, from: "2026-11-09", to: "2026-11-09" }), {
    message: "OpenAI answered 401",
  });
});
