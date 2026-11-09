import { EXPECTED_SPEND, ENVIRONMENTS, spendKey } from "./expectedSpend.mjs";
import { ProviderReadError } from "./ProviderReadError.mjs";

const OPENAI_API = "https://api.openai.com/v1/organization";
const DAY_SECONDS = 86_400;

export const SPLIT_SINCE = "2026-11-09";
export const UNSPLIT = "spend before 9 Nov 2026 is one project for every environment: see unsplit";

export function environmentOfProject(name, date) {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (word === "production" ? "prod" : word));
  const environment = ENVIRONMENTS.find((candidate) => words.at(-1) === candidate || words[0] === candidate) ?? "unattributed";
  return environment === "prod" && date < SPLIT_SINCE ? "unsplit" : environment;
}

export function areaOfLineItem(lineItem) {
  return /embedding/i.test(lineItem ?? "") ? "embeddings" : "generation";
}

export function openAiRowsOf({ projects, buckets }) {
  const nameOf = new Map(projects.map((project) => [project.id, project.name]));
  const totals = new Map();
  for (const bucket of buckets) {
    const date = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
    const split = date >= SPLIT_SINCE;
    for (const expected of EXPECTED_SPEND.filter((spend) => spend.provider === "openai")) {
      totals.set(
        `${date}|${spendKey(expected)}`,
        split
          ? { date, ...expected, dollars: 0, source: "bill" }
          : { date, ...expected, dollars: null, source: "not_tracked", reason: UNSPLIT },
      );
    }
    for (const result of bucket.results) {
      const name = nameOf.get(result.project_id);
      const environment = name === undefined ? "unattributed" : environmentOfProject(name, date);
      const row = { date, provider: "openai", environment, area: areaOfLineItem(result.line_item) };
      const key = `${date}|${spendKey(row)}`;
      const existing = totals.get(key);
      const total = existing === undefined || existing.source !== "bill" ? { ...row, dollars: 0, source: "bill" } : existing;
      total.dollars += Number(result.amount.value);
      totals.set(key, total);
    }
  }
  return [...totals.values()];
}

async function readJson(fetch, url, adminKey) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${adminKey}`, Accept: "application/json" } });
  if (!response.ok) throw new ProviderReadError(`OpenAI answered ${response.status}`);
  return response.json();
}

async function allProjects(fetch, adminKey) {
  const projects = [];
  let after = null;
  do {
    const page = await readJson(
      fetch,
      `${OPENAI_API}/projects?limit=100&include_archived=true${after === null ? "" : `&after=${after}`}`,
      adminKey,
    );
    projects.push(...page.data);
    after = page.has_more ? page.last_id : null;
  } while (after !== null);
  return projects;
}

async function allCostBuckets(fetch, adminKey, from, to) {
  const startTime = Date.parse(`${from}T00:00:00Z`) / 1000;
  const endTime = Date.parse(`${to}T00:00:00Z`) / 1000 + DAY_SECONDS;
  const buckets = [];
  let page = null;
  do {
    const query = `start_time=${startTime}&end_time=${endTime}&bucket_width=1d&group_by=project_id&group_by=line_item&limit=180`;
    const body = await readJson(fetch, `${OPENAI_API}/costs?${query}${page === null ? "" : `&page=${page}`}`, adminKey);
    buckets.push(...body.data);
    page = body.has_more ? body.next_page : null;
  } while (page !== null);
  return buckets;
}

export async function openAiSpend({ adminKey, fetch, from, to }) {
  const [projects, buckets] = await Promise.all([allProjects(fetch, adminKey), allCostBuckets(fetch, adminKey, from, to)]);
  return openAiRowsOf({ projects, buckets });
}
